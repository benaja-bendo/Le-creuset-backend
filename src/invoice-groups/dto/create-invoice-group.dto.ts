import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const CreateInvoiceGroupSchema = z.object({
  // Un groupe à 1 commande n'apporte rien face à une facture individuelle et
  // contrairement à elle n'est jamais visible côté client (aucune route
  // /invoice-groups exposée au rôle CLIENT) — voir l'audit.
  orderIds: z.array(z.string()).min(2, {
    message:
      "Un groupe de facturation doit contenir au moins deux commandes ; une seule commande doit passer par une facture individuelle.",
  }),
  invoiceNumber: z.string().min(1, { message: "Numéro de facture requis" }),
  // Le front envoie `null` (pas juste absent) quand aucun fichier n'a été
  // choisi — une facture groupée peut légitimement se créer sans PDF encore
  // disponible, à ajouter plus tard via PATCH.
  fileUrl: z.string().optional().nullable(),
  // Même règle que pour une facture individuelle : un montant nul est valide,
  // seul un montant négatif ne l'est pas.
  amount: z.number().nonnegative().optional().nullable(),
  issueDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  baseMetalType: z
    .enum(["OR_FIN", "ARGENT_FIN", "PLATINE", "PALLADIUM"])
    .optional(),
  userId: z.string().min(1, { message: "Utilisateur requis" }),
});

export class CreateInvoiceGroupDto extends createZodDto(
  CreateInvoiceGroupSchema,
) {}
