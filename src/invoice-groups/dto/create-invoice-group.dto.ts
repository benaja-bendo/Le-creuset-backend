import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateInvoiceGroupSchema = z.object({
  orderIds: z.array(z.string()).min(1, { message: 'Au moins une commande doit être sélectionnée' }),
  invoiceNumber: z.string().min(1, { message: 'Numéro de facture requis' }),
  fileUrl: z.string().optional(),
  amount: z.number().positive().optional(),
  notes: z.string().optional(),
  baseMetalType: z.enum(['OR_FIN', 'ARGENT_FIN', 'PLATINE', 'PALLADIUM']).optional(),
  userId: z.string().min(1, { message: 'Utilisateur requis' }),
});

export class CreateInvoiceGroupDto extends createZodDto(CreateInvoiceGroupSchema) {}
