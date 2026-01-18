import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MoldsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.mold.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.mold.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { user: { companyName: 'asc' } },
    });
  }

  async create(data: { userId: string; reference: string; name: string; photoUrl?: string }) {
    return this.prisma.mold.create({
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.mold.delete({
      where: { id },
    });
  }
}
