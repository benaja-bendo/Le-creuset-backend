import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const UpdateRoleSchema = z.object({
  role: z.enum(["CLIENT", "ADMIN"]),
  adminPassword: z.string().min(1),
});

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
