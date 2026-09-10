import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class MoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.mold.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * `userId` évite le pire cas relevé par l'audit : admin/Library.tsx
   * téléchargeait les moules de TOUS les clients pour n'en afficher qu'un,
   * filtré ensuite en mémoire.
   */
  async findAll(
    query: { page?: number; limit?: number; userId?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.MoldWhereInput = query.userId
      ? { userId: query.userId }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.mold.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              companyName: true,
            },
          },
        },
        orderBy: { user: { companyName: "asc" } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.mold.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(data: {
    userId: string;
    reference: string;
    name: string;
    photoUrl?: string;
    notes?: string;
  }) {
    return this.prisma.mold.create({
      data,
    });
  }

  async update(
    id: string,
    data: {
      reference?: string;
      name?: string;
      photoUrl?: string;
      notes?: string;
    },
  ) {
    return this.prisma.mold.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.mold.delete({
      where: { id },
    });
  }
}
