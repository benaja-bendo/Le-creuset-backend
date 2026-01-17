import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED']),
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}

