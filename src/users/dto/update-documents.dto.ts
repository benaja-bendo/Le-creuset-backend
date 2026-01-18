import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateDocumentsSchema = z.object({
  kbisFileUrl: z.string().url().optional(),
  customsFileUrl: z.string().url().optional(),
});

export class UpdateDocumentsDto extends createZodDto(UpdateDocumentsSchema) {}
