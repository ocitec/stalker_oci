-- AlterTable: user department (for department-scoped reporting)
ALTER TABLE "users" ADD COLUMN "department" TEXT;

-- AlterTable: link a transaction to its generated receivable invoice
ALTER TABLE "transactions" ADD COLUMN "invoice_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoice_id_key" ON "transactions"("invoice_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
