import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const CloseOrderSchema = z
  .object({
    invoiceNumber: z.string().min(1, { message: "Numéro de facture requis" }),
    invoiceFileUrl: z.string().min(1, { message: "Fichier facture requis" }),
    // Une reprise sous garantie ou un geste commercial peut légitimement clore
    // une commande à 0 € — seule une valeur négative n'a pas de sens.
    finalAmount: z.number().nonnegative().optional(),
    finalWeight: z.number().positive().optional(),
    debitWeightAccount: z.boolean().optional().default(false),
    metalType: z.string().optional(),
  })
  // Sans ce contrôle, cocher « Débiter le compte poids » puis laisser la
  // masse vide clôturait la commande SANS débiter, sans le moindre
  // avertissement (finalWeight?: undefined passait le `if` du service).
  .refine((data) => !data.debitWeightAccount || !!data.finalWeight, {
    message: "Le poids réel est requis pour débiter le compte poids",
    path: ["finalWeight"],
  })
  .refine((data) => !data.debitWeightAccount || !!data.metalType, {
    message: "Le type de métal est requis pour débiter le compte poids",
    path: ["metalType"],
  });

export class CloseOrderDto extends createZodDto(CloseOrderSchema) {}
