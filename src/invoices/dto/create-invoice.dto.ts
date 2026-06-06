import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, { message: "Numéro de facture requis" }),
  // Optionnel : une facture peut être libre ou liée à un dépôt métal (sans commande)
  orderId: z.string().optional(),
  userId: z.string().min(1, { message: "Client requis" }),
  fileUrl: z.string().min(1, { message: "Fichier requis" }),
  amount: z.number().positive().optional().nullable(),
  issueDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  // Transaction métal optionnelle à enregistrer en même temps que la facture
  metalType: z.enum(["OR_FIN", "ARGENT_FIN", "PLATINE"]).optional(),
  metalWeight: z.number().positive().optional(),
  metalTransactionType: z.enum(["CREDIT", "DEBIT"]).optional(),
});

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
