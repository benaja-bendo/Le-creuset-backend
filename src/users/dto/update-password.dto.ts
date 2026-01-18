import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdatePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Le mot de passe actuel doit comporter au moins 6 caractères'),
  newPassword: z.string()
    .min(8, 'Le nouveau mot de passe doit comporter au moins 8 caractères')
    .regex(/[A-Z]/, 'Le nouveau mot de passe doit contenir au moins une majuscule')
    .regex(/[0-9]/, 'Le nouveau mot de passe doit contenir au moins un chiffre'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export class UpdatePasswordDto extends createZodDto(UpdatePasswordSchema) {}
