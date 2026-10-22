import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { newPasswordSchema } from "../password-policy";

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Lien de réinitialisation invalide" }),
  newPassword: newPasswordSchema,
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
