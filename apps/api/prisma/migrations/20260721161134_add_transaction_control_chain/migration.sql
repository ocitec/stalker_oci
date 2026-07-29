-- CreateEnum
CREATE TYPE "SalesRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'ON_HOLD', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'DECLINED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'DECLINED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "sales_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requested_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "SalesRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sales_request_id" TEXT,
    "client_id" TEXT NOT NULL,
    "requested_amount" DECIMAL(15,2) NOT NULL,
    "approved_amount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "CreditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "decision_by_id" TEXT,
    "decision_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "srf_number" TEXT,
    "transaction_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_id" TEXT NOT NULL,
    "client_code" TEXT,
    "sales_request_id" TEXT,
    "credit_request_id" TEXT,
    "new_transaction_value" DECIMAL(15,2) NOT NULL,
    "supplier_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "gross_margin" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "profit_percentage" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_exposure" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "post_transaction_exposure" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "available_credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "exceeds_limit" BOOLEAN NOT NULL DEFAULT false,
    "client_eligible" BOOLEAN NOT NULL DEFAULT true,
    "client_payment_status" "PaymentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "payment_verified" BOOLEAN NOT NULL DEFAULT false,
    "payment_source" TEXT,
    "payment_date" TIMESTAMP(3),
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_level" INTEGER NOT NULL DEFAULT 0,
    "required_approval_level" INTEGER NOT NULL DEFAULT 1,
    "current_approver_role" "UserRole",
    "approval_comments" TEXT,
    "fulfilment_status" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_approvals" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "approver_id" TEXT,
    "approver_role" "UserRole",
    "comments" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_requests_reference_key" ON "sales_requests"("reference");

-- CreateIndex
CREATE INDEX "sales_requests_organization_id_idx" ON "sales_requests"("organization_id");

-- CreateIndex
CREATE INDEX "sales_requests_client_id_idx" ON "sales_requests"("client_id");

-- CreateIndex
CREATE INDEX "sales_requests_status_idx" ON "sales_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_requests_reference_key" ON "credit_requests"("reference");

-- CreateIndex
CREATE INDEX "credit_requests_organization_id_idx" ON "credit_requests"("organization_id");

-- CreateIndex
CREATE INDEX "credit_requests_client_id_idx" ON "credit_requests"("client_id");

-- CreateIndex
CREATE INDEX "credit_requests_status_idx" ON "credit_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_reference_key" ON "transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_srf_number_key" ON "transactions"("srf_number");

-- CreateIndex
CREATE INDEX "transactions_organization_id_idx" ON "transactions"("organization_id");

-- CreateIndex
CREATE INDEX "transactions_client_id_idx" ON "transactions"("client_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_fulfilment_status_idx" ON "transactions"("fulfilment_status");

-- CreateIndex
CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "transaction_approvals_transaction_id_idx" ON "transaction_approvals"("transaction_id");

-- AddForeignKey
ALTER TABLE "sales_requests" ADD CONSTRAINT "sales_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_requests" ADD CONSTRAINT "sales_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_requests" ADD CONSTRAINT "sales_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_sales_request_id_fkey" FOREIGN KEY ("sales_request_id") REFERENCES "sales_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_decision_by_id_fkey" FOREIGN KEY ("decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_requests" ADD CONSTRAINT "credit_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sales_request_id_fkey" FOREIGN KEY ("sales_request_id") REFERENCES "sales_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_request_id_fkey" FOREIGN KEY ("credit_request_id") REFERENCES "credit_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_approvals" ADD CONSTRAINT "transaction_approvals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_approvals" ADD CONSTRAINT "transaction_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
