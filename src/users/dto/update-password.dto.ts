import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { newPasswordSchema } from "../../auth/password-policy";

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: "Le mot de passe actuel est requis" }),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export class UpdatePasswordDto extends createZodDto(UpdatePasswordSchema) {}
