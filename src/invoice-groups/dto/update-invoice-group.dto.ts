import { createZodDto } from "nestjs-zod";
import { CreateInvoiceGroupSchema } from "./create-invoice-group.dto";

// userId exclu : le réaffecter via cette route déplacerait la facture chez un
// autre client sans toucher aux commandes, qui resteraient liées au premier.
// orderIds reste dans le schéma (pour être détecté et rejeté explicitement
// dans le service) : Prisma n'a pas de champ orderIds sur InvoiceGroup, la
// composition d'un groupe n'est pas modifiable via cette route pour l'instant.
export const UpdateInvoiceGroupSchema = CreateInvoiceGroupSchema.omit({
  userId: true,
}).partial();

export class UpdateInvoiceGroupDto extends createZodDto(
  UpdateInvoiceGroupSchema,
) {}
