import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'Numéro de facture requis' }),
  orderId: z.string().min(1, { message: 'Commande requise' }),
  userId: z.string().min(1, { message: 'Client requis' }),
  fileUrl: z.string().min(1, { message: 'Fichier requis' }),
  amount: z.number().positive().optional(),
  issueDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
});

export class CreateInvoiceDto extends createZodDto(CreateInvoiceSchema) {}
