-- AlterEnum: ajout du statut SUSPENDED (désactivation douce d'un compte)
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';

-- AlterTable: la facture peut ne pas être liée à une commande (dépôt métal / facture libre)
ALTER TABLE "invoices" ALTER COLUMN "order_id" DROP NOT NULL;

-- AlterTable: notes + date de création sur les moules
ALTER TABLE "molds" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable: bibliothèque de fichiers STL clients (déposés par l'admin)
CREATE TABLE "library_files" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT,
    "file_url" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_files_user_id_idx" ON "library_files"("user_id");

-- AddForeignKey
ALTER TABLE "library_files" ADD CONSTRAINT "library_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
