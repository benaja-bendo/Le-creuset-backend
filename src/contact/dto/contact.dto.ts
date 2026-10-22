import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// Plafonds larges pour un humain, assez bas pour qu'un robot ne remplisse pas
// la boîte de l'atelier : chaque champ finit tel quel dans l'email envoyé.
export const ContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Le nom est requis" })
    .max(100, { message: "Le nom ne doit pas dépasser 100 caractères" }),
  company: z
    .string()
    .trim()
    .max(150, {
      message: "Le nom de la société ne doit pas dépasser 150 caractères",
    })
    .optional(),
  email: z
    .string()
    .trim()
    .max(254, { message: "Email invalide" })
    .email({ message: "Email invalide" }),
  message: z
    .string()
    .trim()
    .min(1, { message: "Le message est requis" })
    .max(5000, { message: "Le message ne doit pas dépasser 5000 caractères" }),
  // Pot de miel : champ caché du formulaire, qu'un humain laisse vide et
  // qu'un robot remplit (voir ContactService.send).
  website: z.string().optional(),
});

export class ContactDto extends createZodDto(ContactSchema) {}
