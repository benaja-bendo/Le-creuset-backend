/*
  Warnings:

  - A unique constraint covering the columns `[user_id,metal_type]` on the table `metal_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "metal_accounts_user_id_metal_type_key" ON "metal_accounts"("user_id", "metal_type");
