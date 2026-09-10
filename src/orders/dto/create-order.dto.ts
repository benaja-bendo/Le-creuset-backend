import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { MetalType } from "@prisma/client";

export const CreateManualOrderSchema = z.object({
  userId: z.string().min(1, { message: "Client requis" }),
  estimatedPrice: z.number().nonnegative().optional(),
  materialType: z.nativeEnum(MetalType).optional(),
  notes: z.string().optional(),
  orderNumber: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

export class CreateManualOrderDto extends createZodDto(
  CreateManualOrderSchema,
) {}
