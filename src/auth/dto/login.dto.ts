import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// Pas de longueur minimale ici, volontairement : la règle des mots de passe
// (password-policy.ts) s'applique à leur création. Contrôler la longueur à la
// connexion bloquerait tout compte créé sous une ancienne règle.
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, { message: "Mot de passe requis" }),
});

export class LoginDto extends createZodDto(LoginSchema) {}
