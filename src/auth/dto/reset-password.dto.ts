import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// Même règle qu'à l'inscription : un mot de passe accepté ici doit passer
// LoginSchema ensuite, sinon le compte devient inaccessible.
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Lien de réinitialisation invalide" }),
  newPassword: z
    .string()
    .min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" }),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
