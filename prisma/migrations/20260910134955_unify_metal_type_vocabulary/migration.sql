-- Unifie le vocabulaire d'alliage (audit §2.4) : l'enum MetalType utilisait
-- une nomenclature alliage-d'abord ("OR_JAUNE_750") jamais respectee par le
-- seul code qui ecrivait reellement dans orders.material_type
-- (admin/Orders.tsx, purete-d'abord : "OR_750_JAUNE") — la colonne etait un
-- String? brut, sans validation Prisma ni Zod. On renomme l'enum pour
-- suivre la nomenclature deja utilisee par toutes les donnees reelles
-- (verifie : aucune ligne ne porte l'ancien libelle), plutot que de
-- reecrire les donnees. LAITON et PROTOTYPE_RESINE, deja proposes par le
-- formulaire admin mais absents de l'enum, sont ajoutes.

ALTER TYPE "MetalType" RENAME VALUE 'OR_JAUNE_375' TO 'OR_375_JAUNE';
ALTER TYPE "MetalType" RENAME VALUE 'OR_JAUNE_750' TO 'OR_750_JAUNE';
ALTER TYPE "MetalType" RENAME VALUE 'OR_ROSE_375' TO 'OR_375_ROSE';
ALTER TYPE "MetalType" RENAME VALUE 'OR_ROSE_750' TO 'OR_750_ROSE';
ALTER TYPE "MetalType" RENAME VALUE 'OR_GRIS_375' TO 'OR_375_GRIS';
ALTER TYPE "MetalType" RENAME VALUE 'OR_GRIS_750' TO 'OR_750_GRIS';
ALTER TYPE "MetalType" RENAME VALUE 'OR_GRIS_750_PALLADIE_13' TO 'OR_750_PALLADIE_13';
ALTER TYPE "MetalType" RENAME VALUE 'OR_ROUGE_750' TO 'OR_750_ROUGE';

ALTER TYPE "MetalType" ADD VALUE 'LAITON';
ALTER TYPE "MetalType" ADD VALUE 'PROTOTYPE_RESINE';

-- Order.materialType passe de String? a MetalType? : jusqu'ici l'enum etait
-- declaree mais jamais utilisee comme type de colonne, donc aucune
-- validation ne portait sur cette colonne (back/src/orders/orders.controller.ts
-- faisait un `dto as any`). Le cast reussit sans perte : toutes les valeurs
-- reelles correspondent deja a un libelle de l'enum apres renommage ci-dessus.
ALTER TABLE "orders" ALTER COLUMN "material_type" TYPE "MetalType" USING ("material_type"::"MetalType");
