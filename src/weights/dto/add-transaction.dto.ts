import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const AddTransactionSchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"]),
  // Toujours une magnitude positive : c'est `type` qui porte le sens du
  // mouvement. Sans cette contrainte, un montant négatif sur un CREDIT
  // débitait silencieusement le compte au lieu de le créditer.
  amount: z.number().positive({ message: "Le montant doit être positif" }),
  label: z.string().min(1, { message: "Libellé requis" }),
  date: z.string().optional(), // ISO date string
});

export class AddTransactionDto extends createZodDto(AddTransactionSchema) {}
