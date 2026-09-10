import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { MetalType } from "@prisma/client";

export const UpdateOrderSchema = z.object({
  materialType: z.nativeEnum(MetalType).optional(),
  notes: z.string().optional(),
  stlFileUrl: z.string().optional(),
  quantity: z.number().int().positive().optional(),
});

export class UpdateOrderDto extends createZodDto(UpdateOrderSchema) {}
