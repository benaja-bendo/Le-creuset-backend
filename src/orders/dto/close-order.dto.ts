import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CloseOrderSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'Numéro de facture requis' }),
  invoiceFileUrl: z.string().min(1, { message: 'Fichier facture requis' }),
  finalAmount: z.number().positive().optional(),
  finalWeight: z.number().positive().optional(),
  debitWeightAccount: z.boolean().optional().default(false),
  metalType: z.string().optional(),
});

export class CloseOrderDto extends createZodDto(CloseOrderSchema) {}
