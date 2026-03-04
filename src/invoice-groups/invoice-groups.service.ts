import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateInvoiceGroupDto } from './dto/create-invoice-group.dto';
import { UpdateInvoiceGroupDto } from './dto/update-invoice-group.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify orders exist, belong to user, and are not already grouped
      const orders = await tx.order.findMany({
        where: {
          id: { in: dto.orderIds },
          userId: dto.userId,
        },
      });

      if (orders.length !== dto.orderIds.length) {
        throw new BadRequestException('Certaines commandes sont introuvables ou ne vous appartiennent pas.');
      }

      const alreadyGrouped = orders.filter(o => o.invoiceGroupId !== null);
      if (alreadyGrouped.length > 0) {
        throw new BadRequestException('Certaines commandes font déjà partie d\'un groupe de facturation.');
      }

      // 2. Create the invoice group
      const group = await tx.invoiceGroup.create({
        data: {
          invoiceNumber: dto.invoiceNumber,
          userId: dto.userId,
          fileUrl: dto.fileUrl,
          amount: dto.amount,
          notes: dto.notes,
          baseMetalType: dto.baseMetalType,
        },
      });

      // 3. Link orders to the new group
      await tx.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: { invoiceGroupId: group.id },
      });

      return await tx.invoiceGroup.findUnique({
        where: { id: group.id },
        include: { orders: true },
      });
    });
  }

  findAll() {
    return this.prisma.invoiceGroup.findMany({
      include: {
        user: { select: { companyName: true, email: true } },
        orders: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.invoiceGroup.findUnique({
      where: { id },
      include: {
        orders: true,
        user: true,
      },
    });
    if (!group) throw new NotFoundException('Groupe introuvable');
    return group;
  }

  update(id: string, updateInvoiceGroupDto: UpdateInvoiceGroupDto) {
    return this.prisma.invoiceGroup.update({
      where: { id },
      data: updateInvoiceGroupDto,
    });
  }

  remove(id: string) {
    return this.prisma.invoiceGroup.delete({
      where: { id },
    });
  }
}
