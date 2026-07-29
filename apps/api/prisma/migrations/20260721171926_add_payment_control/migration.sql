-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDING', 'APPROVED', 'FUNDED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PaymentExceptionType" AS ENUM ('PAYMENT_MISMATCH', 'DUPLICATE_PAYMENT', 'MISSING_CONFIRMATION', 'OVERPAYMENT', 'UNDERPAYMENT', 'CURRENCY_MISMATCH');

-- CreateEnum
CREATE TYPE "PaymentExceptionStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_account_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "current_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "minimum_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "operational_account_id" TEXT,
    "requested_amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "account_balance_at_request" DECIMAL(18,2),
    "replenishment_required" BOOLEAN NOT NULL DEFAULT false,
    "payment_amount" DECIMAL(18,2),
    "payment_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod",
    "confirmation_reference" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_comments" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "operational_account_id" TEXT NOT NULL,
    "required_amount" DECIMAL(18,2) NOT NULL,
    "requested_amount" DECIMAL(18,2) NOT NULL,
    "approved_amount" DECIMAL(18,2),
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requested_by_id" TEXT,
    "decision_by_id" TEXT,
    "decision_at" TIMESTAMP(3),
    "funded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_exceptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "payment_request_id" TEXT,
    "type" "PaymentExceptionType" NOT NULL,
    "status" "PaymentExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "detail" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");

-- CreateIndex
CREATE INDEX "suppliers_is_active_idx" ON "suppliers"("is_active");

-- CreateIndex
CREATE INDEX "operational_accounts_organization_id_idx" ON "operational_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "operational_accounts_is_active_idx" ON "operational_accounts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_reference_key" ON "payment_requests"("reference");

-- CreateIndex
CREATE INDEX "payment_requests_organization_id_idx" ON "payment_requests"("organization_id");

-- CreateIndex
CREATE INDEX "payment_requests_transaction_id_idx" ON "payment_requests"("transaction_id");

-- CreateIndex
CREATE INDEX "payment_requests_supplier_id_idx" ON "payment_requests"("supplier_id");

-- CreateIndex
CREATE INDEX "payment_requests_status_idx" ON "payment_requests"("status");

-- CreateIndex
CREATE INDEX "payment_requests_due_date_idx" ON "payment_requests"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "replenishments_reference_key" ON "replenishments"("reference");

-- CreateIndex
CREATE INDEX "replenishments_organization_id_idx" ON "replenishments"("organization_id");

-- CreateIndex
CREATE INDEX "replenishments_operational_account_id_idx" ON "replenishments"("operational_account_id");

-- CreateIndex
CREATE INDEX "replenishments_status_idx" ON "replenishments"("status");

-- CreateIndex
CREATE INDEX "payment_exceptions_organization_id_idx" ON "payment_exceptions"("organization_id");

-- CreateIndex
CREATE INDEX "payment_exceptions_status_idx" ON "payment_exceptions"("status");

-- CreateIndex
CREATE INDEX "payment_exceptions_type_idx" ON "payment_exceptions"("type");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_accounts" ADD CONSTRAINT "operational_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_operational_account_id_fkey" FOREIGN KEY ("operational_account_id") REFERENCES "operational_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_operational_account_id_fkey" FOREIGN KEY ("operational_account_id") REFERENCES "operational_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishments" ADD CONSTRAINT "replenishments_decision_by_id_fkey" FOREIGN KEY ("decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_payment_request_id_fkey" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
