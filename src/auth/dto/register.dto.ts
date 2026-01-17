import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  companyName: z.string().min(2),
  phone: z.string().min(6),
  address: z.string().min(6),
  kbisFileUrl: z.string().url(),
  customsFileUrl: z.string().url(),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

