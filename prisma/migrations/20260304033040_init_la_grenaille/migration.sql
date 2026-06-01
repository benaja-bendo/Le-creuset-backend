/*
  Warnings:

  - You are about to drop the column `finish_type` on the `orders` table. All the data in the column will be lost.
  - Changed the type of `metal_type` on the `metal_accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BaseMetalType" AS ENUM ('OR_FIN', 'ARGENT_FIN', 'PLATINE', 'PALLADIUM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MetalType" ADD VALUE 'OR_ROSE_375';
ALTER TYPE "MetalType" ADD VALUE 'OR_GRIS_375';
ALTER TYPE "MetalType" ADD VALUE 'OR_GRIS_750_PALLADIE_13';
ALTER TYPE "MetalType" ADD VALUE 'OR_ROUGE_750';
ALTER TYPE "MetalType" ADD VALUE 'PROTO_VISUEL';
ALTER TYPE "MetalType" ADD VALUE 'IMPRESSION_CIRE';

-- AlterTable
ALTER TABLE "metal_accounts" ALTER COLUMN "metal_type" TYPE "BaseMetalType" USING (
  CASE 
    WHEN "metal_type"::text = 'ARGENT_925' THEN 'ARGENT_FIN'::"BaseMetalType"
    WHEN "metal_type"::text = 'PLATINE_950' THEN 'PLATINE'::"BaseMetalType"
    WHEN "metal_type"::text = 'PALLADIUM' THEN 'PALLADIUM'::"BaseMetalType"
    ELSE 'OR_FIN'::"BaseMetalType" 
  END
);

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "finish_type",
ADD COLUMN     "invoice_group_id" TEXT,
ADD COLUMN     "is_manual_order" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "invoice_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_metal_type" "BaseMetalType",
    "invoice_number" TEXT NOT NULL,
    "file_url" TEXT,
    "amount" DECIMAL(10,2),
    "notes" TEXT,
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_groups_invoice_number_key" ON "invoice_groups"("invoice_number");

-- CreateIndex
CREATE INDEX "invoice_groups_user_id_idx" ON "invoice_groups"("user_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_group_id_fkey" FOREIGN KEY ("invoice_group_id") REFERENCES "invoice_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_groups" ADD CONSTRAINT "invoice_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
