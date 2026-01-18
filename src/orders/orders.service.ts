import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { userId: string; stlFileUrl?: string; estimatedPrice?: number }) {
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        status: OrderStatus.EN_ATTENTE,
        stlFileUrl: data.stlFileUrl,
        estimatedPrice: data.estimatedPrice,
      },
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Commande non trouvée');

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { user: true },
    });
  }
}
