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
  fileUrl: z.string().optional(),
  amount: z.number().positive().optional().nullable(),
  notes: z.string().optional(),
  baseMetalType: z
    .enum(["OR_FIN", "ARGENT_FIN", "PLATINE", "PALLADIUM"])
    .optional(),
  userId: z.string().min(1, { message: "Utilisateur requis" }),
});

export class CreateInvoiceGroupDto extends createZodDto(
  CreateInvoiceGroupSchema,
) {}
