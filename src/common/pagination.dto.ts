import { z } from "zod";
import { createZodDto } from "nestjs-zod";

/**
 * Contrat de pagination partagé par les listes admin. `limit` plafonne à 500
 * plutôt qu'à une valeur plus stricte : plusieurs écrans (sélecteurs de
 * client/commande) ont besoin de "tout" pour peupler un menu déroulant, pas
 * d'une page — ils demandent explicitement une grande limite plutôt que de
 * paginer une liste conçue pour être parcourue.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(500).optional().default(20),
  search: z.string().optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
});

export class PaginationQueryDto extends createZodDto(PaginationQuerySchema) {}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
