import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  companyName: z.string().min(2).optional(),
  phone: z.string().min(6).optional(),
  address: z.string().min(6).optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
