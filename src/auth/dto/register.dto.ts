import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Accepte soit une URL complète, soit un chemin relatif commençant par /api/
const filePathOrUrl = z.string().refine(
  (val) => val.startsWith('/api/') || val.startsWith('http://') || val.startsWith('https://'),
  { message: 'Doit être un chemin de fichier valide ou une URL' }
);

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' }),
  name: z.string().optional(),
  companyName: z.string().min(2, { message: 'Le nom de l\'entreprise doit contenir au moins 2 caractères' }),
  phone: z.string().min(6, { message: 'Numéro de téléphone invalide' }),
  address: z.string().min(6, { message: 'Adresse trop courte' }),
  kbisFileUrl: filePathOrUrl,
  customsFileUrl: filePathOrUrl,
});

export class RegisterDto extends createZodDto(RegisterSchema) {}


