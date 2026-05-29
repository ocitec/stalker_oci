
import { PrismaClient, UserRole, ClientRisk, InvoiceStatus, FollowUpType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { addDays, subDays } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

async function main() {
  console.log('🌱 Seeding Stalker v1 database...');

  // ── Organization ──────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-soas-001' },
    update: {},
    create: {
      id: 'org-soas-001',
      name: 'SOAS Corp',
      industry: 'B2B Services',
    },
  });

  // ── Users ─────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const cfo = await prisma.user.upsert({
    where: { email: 'amaka.obi@soascorp.ng' },
    update: {},
    create: {
      name: 'Amaka Obi',
      email: 'amaka.obi@soascorp.ng',
      passwordHash,
      role: UserRole.CFO,
      organizationId: org.id,
    },
  });

  const financeUser = await prisma.user.upsert({
    where: { email: 'chidi.nwosu@soascorp.ng' },
    update: {},
    create: {
      name: 'Chidi Nwosu',
      email: 'chidi.nwosu@soascorp.ng',
      passwordHash,
      role: UserRole.FINANCE,
      organizationId: org.id,
    },
  });

  // ── Clients ───────────────────────────────────
  const clientsData = [
    { name: 'MTN Nigeria Plc', sector: 'Telecom', pdi: 38, credit: 500000,  sla: 30, risk: ClientRisk.CHRONIC, email: 'finance@mtn.ng', blocked: false },
  ];

  const clients = [];
  for (const cd of clientsData) {
    const client = await prisma.client.create({
      data: {
        name: cd.name,
        sector: cd.sector,
        email: cd.email,
        paymentDisciplineIndex: cd.pdi,
        creditLimit: cd.credit,
        slaDays: cd.sla,
        riskStatus: cd.risk,
        isBlocked: cd.blocked ?? false,
        blockedReason: cd.blocked ? 'Auto-blocked: PDI below 30 (chronic delayer)' : null,
        organizationId: org.id,
      },
    });
    clients.push(client);
  }

  // ── Invoices ──────────────────────────────────
  const invoiceStatuses: Array<{ clientIdx: number; amount: number; daysAgo: number; dueDaysAgo: number; status: InvoiceStatus; paidDaysAgo?: number }> = [
    { clientIdx: 0, amount: 48500,  daysAgo: 45, dueDaysAgo: 14, status: 'OVERDUE' },
  ];

  const invoices = [];
  let invoiceCounter = 440;
  for (const inv of invoiceStatuses) {
    invoiceCounter++;
    const invoiceDate = subDays(new Date(), inv.daysAgo);
    const dueDate = inv.dueDaysAgo >= 0
      ? subDays(new Date(), inv.dueDaysAgo)
      : addDays(new Date(), Math.abs(inv.dueDaysAgo));

    const invoice = await prisma.invoice.create({
      data: {
        clientId: clients[inv.clientIdx].id,
        invoiceNumber: `INV-2025-0${invoiceCounter}`,
        invoiceAmount: inv.amount,
        invoiceDate,
        dueDate,
        status: inv.status,
        paidDate: inv.paidDaysAgo ? subDays(new Date(), inv.paidDaysAgo) : null,
        paidAmount: inv.paidDaysAgo ? inv.amount : null,
      },
    });
    invoices.push(invoice);

    // Create SLA violations for overdue
    if (inv.status === 'OVERDUE') {
      await prisma.slaViolation.create({
        data: {
          clientId: clients[inv.clientIdx].id,
          invoiceId: invoice.id,
          daysLate: inv.dueDaysAgo,
        },
      });
    }
  }

  // ── Follow-ups ─────────────────────────────────
  const overdueInvoices = invoices.filter((_, i) => invoiceStatuses[i].status === 'OVERDUE');
  for (let i = 0; i < overdueInvoices.length; i++) {
    const inv = overdueInvoices[i];
    const daysSince = [9, 12, 5, 7, 6, 11][i] ?? 3;

    if (daysSince < 10) {
      await prisma.followUp.create({
        data: {
          invoiceId: inv.id,
          userId: financeUser.id,
          followUpType: FollowUpType.EMAIL,
          followUpDate: subDays(new Date(), daysSince),
          notes: `Sent payment reminder. Client acknowledged receipt.`,
          responseReceived: daysSince < 5,
        },
      });
    }
  }

  console.log(`✅ Seeded: 1 org, 2 users, ${clients.length} clients, ${invoices.length} invoices`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   CFO:     amaka.obi@soascorp.ng / Password123!`);
  console.log(`   Finance: chidi.nwosu@soascorp.ng / Password123!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
