/**
 * Seed data for the financial control chain (Sales → Credit → Transaction →
 * Payment Control) and its supporting masters (suppliers, operational accounts).
 *
 * Idempotent: wipes the org's control-chain rows first, then recreates a realistic
 * spread across every workflow state so the frontend has data to render.
 *
 * Run:  npx tsx prisma/seed-control.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { addDays, subDays } from 'date-fns';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

const ref = (prefix: string, n: number) => `${prefix}-SEED-${String(n).padStart(4, '0')}`;
const margin = (value: number, cost: number) => ({
  grossMargin: +(value - cost).toFixed(2),
  profitPercentage: value > 0 ? +(((value - cost) / value) * 100).toFixed(2) : 0,
});

async function main() {
  console.log('🌱 Seeding financial control chain...');

  const org = await prisma.organization.findFirst({ where: { id: 'org-soas-001' } })
    ?? await prisma.organization.findFirst();
  if (!org) throw new Error('No organization found — run the base seed (prisma/seed.ts) first.');
  const orgId = org.id;

  // ── Users: departments + a CFO ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);
  await prisma.user.updateMany({ where: { email: 'amaka.obi@soascorp.ng' }, data: { department: 'Executive' } });
  await prisma.user.updateMany({ where: { email: 'chidi.nwosu@soascorp.ng' }, data: { department: 'Finance' } });
  const cfo = await prisma.user.upsert({
    where:  { email: 'ngozi.eze@soascorp.ng' },
    update: { department: 'Finance' },
    create: { name: 'Ngozi Eze', email: 'ngozi.eze@soascorp.ng', passwordHash, role: 'CFO', department: 'Finance', organizationId: orgId },
  });
  const ops = await prisma.user.upsert({
    where:  { email: 'tunde.bello@soascorp.ng' },
    update: { department: 'Operations' },
    create: { name: 'Tunde Bello', email: 'tunde.bello@soascorp.ng', passwordHash, role: 'SALES', department: 'Sales', organizationId: orgId },
  });
  const finance = await prisma.user.findFirst({ where: { email: 'chidi.nwosu@soascorp.ng' } });
  const admin   = await prisma.user.findFirst({ where: { email: 'amaka.obi@soascorp.ng' } });
  const creatorId = finance?.id ?? admin?.id ?? cfo.id;

  // ── Clients (with credit limits so exposure reports have data) ──────────────
  const clientSeeds = [
    { reg: 'RC-SEED-001', name: 'Dangote Cement Plc', sector: 'Manufacturing', credit: 15_000_000, pdi: 82, risk: 'RELIABLE' as const },
    { reg: 'RC-SEED-002', name: 'Jumia Technologies', sector: 'E-commerce',    credit: 8_000_000,  pdi: 64, risk: 'MODERATE' as const },
    { reg: 'RC-SEED-003', name: 'Zenith Bank Plc',    sector: 'Banking',       credit: 25_000_000, pdi: 91, risk: 'RELIABLE' as const },
  ];
  const clients: Record<string, any> = {};
  for (const c of clientSeeds) {
    clients[c.reg] = await prisma.client.upsert({
      where:  { companyRegistration: c.reg },
      update: { creditLimit: c.credit, paymentDisciplineIndex: c.pdi, riskStatus: c.risk },
      create: {
        organizationId: orgId, name: c.name, sector: c.sector, companyRegistration: c.reg,
        email: `ap@${c.name.split(' ')[0].toLowerCase()}.example`, creditLimit: c.credit,
        paymentDisciplineIndex: c.pdi, riskStatus: c.risk, slaDays: 30,
      },
    });
  }

  // ── Idempotent wipe of prior control-chain seed for this org ────────────────
  await prisma.paymentException.deleteMany({ where: { organizationId: orgId } });
  await prisma.replenishment.deleteMany({ where: { organizationId: orgId } });
  await prisma.paymentRequest.deleteMany({ where: { organizationId: orgId } });
  await prisma.transactionApproval.deleteMany({ where: { transaction: { organizationId: orgId } } });
  await prisma.transaction.deleteMany({ where: { organizationId: orgId } });
  await prisma.creditRequest.deleteMany({ where: { organizationId: orgId } });
  await prisma.salesRequest.deleteMany({ where: { organizationId: orgId } });
  await prisma.operationalAccount.deleteMany({ where: { organizationId: orgId } });
  await prisma.supplier.deleteMany({ where: { organizationId: orgId } });
  await prisma.paymentRecord.deleteMany({ where: { invoice: { invoiceNumber: { startsWith: 'RCV-' + ref('TXN', 0).split('-SEED')[0] } } } }).catch(() => {});
  await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: 'RCV-TXN-SEED' } } });

  // ── Suppliers ───────────────────────────────────────────────────────────────
  const suppliers = [];
  for (const [i, s] of [
    { name: 'Alpha Logistics Ltd',    bank: 'GTBank',    acct: '0011223344' },
    { name: 'Beta Hardware Supplies',  bank: 'Access Bank', acct: '0022334455' },
    { name: 'Gamma Cloud Services',    bank: 'Zenith Bank', acct: '0033445566' },
    { name: 'Delta Facilities Co',     bank: 'UBA',       acct: '0044556677' },
  ].entries()) {
    suppliers.push(await prisma.supplier.create({
      data: {
        organizationId: orgId, name: s.name, code: ref('SUP', i + 1),
        email: `billing@${s.name.split(' ')[0].toLowerCase()}.example`,
        bankName: s.bank, bankAccountNumber: s.acct, bankAccountName: s.name, isActive: true,
      },
    }));
  }

  // ── Operational accounts (one healthy, one below minimum) ───────────────────
  const mainAccount = await prisma.operationalAccount.create({
    data: { organizationId: orgId, name: 'Main Disbursement Account', accountNumber: '1234567890', bankName: 'GTBank', currency: 'NGN', currentBalance: 12_000_000, minimumBalance: 2_000_000 },
  });
  const lowAccount = await prisma.operationalAccount.create({
    data: { organizationId: orgId, name: 'Secondary Ops Account', accountNumber: '9876543210', bankName: 'Access Bank', currency: 'NGN', currentBalance: 350_000, minimumBalance: 1_000_000 },
  });

  // ── Sales → Credit → Transaction chains ─────────────────────────────────────
  let n = 0;
  const clientList = Object.values(clients);

  async function chain(opts: {
    client: any; title: string; value: number; cost: number;
    salesStatus: any; creditStatus?: any; txnStatus?: any;
    fulfilment?: any; withReceivable?: boolean; verified?: boolean;
  }) {
    n++;
    const sr = await prisma.salesRequest.create({
      data: {
        organizationId: orgId, reference: ref('SR', n), clientId: opts.client.id,
        title: opts.title, description: `Seeded sales request — ${opts.title}`,
        requestedAmount: opts.value, currency: 'NGN', status: opts.salesStatus,
        createdById: ops.id, submittedAt: opts.salesStatus === 'DRAFT' ? null : subDays(new Date(), 20 - n),
      },
    });
    if (!opts.creditStatus) return { sr };

    const cr = await prisma.creditRequest.create({
      data: {
        organizationId: orgId, reference: ref('CR', n), salesRequestId: sr.id, clientId: opts.client.id,
        requestedAmount: opts.value, approvedAmount: opts.creditStatus === 'APPROVED' ? opts.value : null,
        currency: 'NGN', status: opts.creditStatus, createdById: creatorId,
        decisionById: opts.creditStatus === 'PENDING' ? null : cfo.id,
        decisionAt: opts.creditStatus === 'PENDING' ? null : subDays(new Date(), 18 - n),
      },
    });
    if (!opts.txnStatus) return { sr, cr };

    // Exposure snapshot
    const agg = await prisma.invoice.aggregate({
      where: { clientId: opts.client.id, status: { in: ['PENDING', 'DUE_TODAY', 'OVERDUE', 'PARTIALLY_PAID'] } },
      _sum: { remainingBalance: true },
    });
    const currentExposure = Number(agg._sum.remainingBalance ?? 0);
    const creditLimit = Number(opts.client.creditLimit);
    const post = currentExposure + opts.value;
    const m = margin(opts.value, opts.cost);

    let invoiceId: string | null = null;
    if (opts.withReceivable) {
      const rcv = await prisma.invoice.create({
        data: {
          clientId: opts.client.id, invoiceNumber: `RCV-${ref('TXN', n)}`, invoiceAmount: opts.value,
          remainingBalance: opts.verified ? 0 : opts.value, amountPaid: opts.verified ? opts.value : 0,
          invoiceDate: subDays(new Date(), 10), dueDate: addDays(new Date(), 20),
          status: opts.verified ? 'PAID' : 'PENDING', paidDate: opts.verified ? new Date() : null,
          currency: 'NGN', notes: `Auto receivable for ${ref('TXN', n)}`,
        },
      });
      invoiceId = rcv.id;
      if (opts.verified) {
        await prisma.paymentRecord.create({ data: { invoiceId: rcv.id, paidBy: creatorId, amount: opts.value, paymentDate: new Date() } });
      }
    }

    const txn = await prisma.transaction.create({
      data: {
        organizationId: orgId, reference: ref('TXN', n), srfNumber: ref('SRF', n),
        clientId: opts.client.id, clientCode: opts.client.companyRegistration,
        salesRequestId: sr.id, creditRequestId: cr.id, invoiceId,
        newTransactionValue: opts.value, supplierCost: opts.cost, grossMargin: m.grossMargin, profitPercentage: m.profitPercentage,
        currency: 'NGN', creditLimit, currentExposure, postTransactionExposure: post,
        availableCredit: Math.max(0, creditLimit - currentExposure),
        exceedsLimit: creditLimit > 0 && post > creditLimit, clientEligible: !opts.client.isBlocked,
        clientPaymentStatus: opts.verified ? 'VERIFIED' : 'PENDING', paymentVerified: !!opts.verified,
        status: opts.txnStatus, approvalLevel: opts.txnStatus === 'APPROVED' ? (opts.value >= 1_000_000 ? 2 : 1) : opts.txnStatus === 'PENDING_REVIEW' ? 0 : 0,
        requiredApprovalLevel: opts.value >= 1_000_000 ? 2 : 1,
        currentApproverRole: opts.txnStatus === 'PENDING_REVIEW' ? 'FINANCE' : null,
        fulfilmentStatus: opts.fulfilment ?? 'PENDING', createdById: creatorId,
      },
    });
    if (opts.txnStatus === 'APPROVED') {
      const levels = opts.value >= 1_000_000 ? 2 : 1;
      for (let l = 1; l <= levels; l++) {
        await prisma.transactionApproval.create({
          data: { transactionId: txn.id, level: l, decision: 'APPROVED', approverId: l === 2 ? cfo.id : creatorId, approverRole: l === 2 ? 'CFO' : 'FINANCE', comments: `Level ${l} approved` },
        });
      }
    }
    return { sr, cr, txn };
  }

  const c1 = await chain({ client: clientList[0], title: 'Bulk cement supply Q3', value: 3_500_000, cost: 2_600_000, salesStatus: 'CONVERTED', creditStatus: 'APPROVED', txnStatus: 'APPROVED', fulfilment: 'FULFILLED', withReceivable: true, verified: true });
  const c2 = await chain({ client: clientList[1], title: 'Warehouse fit-out',      value: 1_800_000, cost: 1_400_000, salesStatus: 'CONVERTED', creditStatus: 'APPROVED', txnStatus: 'APPROVED', fulfilment: 'PROCESSING', withReceivable: true, verified: false });
  const c3 = await chain({ client: clientList[2], title: 'Cloud migration svc',    value: 900_000,   cost: 600_000,   salesStatus: 'CONVERTED', creditStatus: 'APPROVED', txnStatus: 'PENDING_REVIEW' });
  await chain({ client: clientList[0], title: 'Fleet maintenance',      value: 450_000,   cost: 300_000,   salesStatus: 'APPROVED', creditStatus: 'PENDING' });
  await chain({ client: clientList[1], title: 'Marketing campaign',     value: 2_200_000, cost: 1_900_000, salesStatus: 'CONVERTED', creditStatus: 'DECLINED' });
  await chain({ client: clientList[2], title: 'Draft supply request',    value: 600_000,   cost: 420_000,   salesStatus: 'SUBMITTED' });
  await chain({ client: clientList[0], title: 'Office equipment',        value: 300_000,   cost: 210_000,   salesStatus: 'DRAFT' });

  // ── Payment requests against approved transactions ──────────────────────────
  const paidPr = await prisma.paymentRequest.create({
    data: {
      organizationId: orgId, reference: ref('PR', 1), transactionId: c1.txn!.id, supplierId: suppliers[0].id,
      operationalAccountId: mainAccount.id, requestedAmount: 2_600_000, currency: 'NGN', status: 'PAID',
      accountBalanceAtRequest: 12_000_000, paymentAmount: 2_600_000, paymentDate: subDays(new Date(), 3),
      paymentMethod: 'BANK_TRANSFER', confirmationReference: 'TRX-SEED-0001', confirmedAt: subDays(new Date(), 2),
      approvedById: cfo.id, approvedAt: subDays(new Date(), 4), createdById: creatorId,
    },
  });
  const processingPr = await prisma.paymentRequest.create({
    data: {
      organizationId: orgId, reference: ref('PR', 2), transactionId: c2.txn!.id, supplierId: suppliers[1].id,
      operationalAccountId: mainAccount.id, requestedAmount: 1_400_000, currency: 'NGN', status: 'PROCESSING',
      accountBalanceAtRequest: 9_400_000, paymentAmount: 1_400_000, paymentDate: subDays(new Date(), 4),
      paymentMethod: 'BANK_TRANSFER', approvedById: cfo.id, approvedAt: subDays(new Date(), 5), createdById: creatorId,
    },
  });
  await prisma.paymentRequest.create({
    data: {
      organizationId: orgId, reference: ref('PR', 3), transactionId: c2.txn!.id, supplierId: suppliers[2].id,
      operationalAccountId: mainAccount.id, requestedAmount: 300_000, currency: 'NGN', status: 'APPROVED',
      accountBalanceAtRequest: 9_400_000, dueDate: subDays(new Date(), 1), approvedById: cfo.id, approvedAt: subDays(new Date(), 1), createdById: creatorId,
    },
  });
  await prisma.paymentRequest.create({
    data: {
      organizationId: orgId, reference: ref('PR', 4), transactionId: c1.txn!.id, supplierId: suppliers[3].id,
      operationalAccountId: lowAccount.id, requestedAmount: 800_000, currency: 'NGN', status: 'PENDING_APPROVAL',
      accountBalanceAtRequest: 350_000, replenishmentRequired: true, createdById: creatorId,
    },
  });
  await prisma.paymentRequest.create({
    data: {
      organizationId: orgId, reference: ref('PR', 5), transactionId: c1.txn!.id, supplierId: suppliers[0].id,
      operationalAccountId: mainAccount.id, requestedAmount: 150_000, currency: 'NGN', status: 'DRAFT', createdById: creatorId,
    },
  });

  // ── Replenishment for the low account ───────────────────────────────────────
  await prisma.replenishment.create({
    data: { organizationId: orgId, reference: ref('RPL', 1), operationalAccountId: lowAccount.id, requiredAmount: 800_000, requestedAmount: 1_500_000, status: 'PENDING', requestedById: creatorId, notes: 'Top up to clear pending supplier payment' },
  });

  // ── Payment exceptions ──────────────────────────────────────────────────────
  await prisma.paymentException.create({
    data: { organizationId: orgId, paymentRequestId: processingPr.id, type: 'MISSING_CONFIRMATION', status: 'OPEN', detail: 'Payment processing for 96h without confirmation' },
  });
  await prisma.paymentException.create({
    data: { organizationId: orgId, paymentRequestId: paidPr.id, type: 'OVERPAYMENT', status: 'RESOLVED', detail: 'Disbursed slightly above requested', resolvedById: cfo.id, resolvedAt: subDays(new Date(), 1) },
  });

  const counts = {
    suppliers: suppliers.length,
    accounts: 2,
    sales: await prisma.salesRequest.count({ where: { organizationId: orgId } }),
    credit: await prisma.creditRequest.count({ where: { organizationId: orgId } }),
    transactions: await prisma.transaction.count({ where: { organizationId: orgId } }),
    payments: await prisma.paymentRequest.count({ where: { organizationId: orgId } }),
  };
  console.log('✅ Control-chain seed complete:', counts);
  console.log('   New logins (Password123!): ngozi.eze@soascorp.ng (CFO), tunde.bello@soascorp.ng (SALES)');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
