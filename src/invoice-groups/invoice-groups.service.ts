import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateInvoiceGroupDto } from "./dto/create-invoice-group.dto";
import { UpdateInvoiceGroupDto } from "./dto/update-invoice-group.dto";
import { PrismaService } from "../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";

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
        throw new BadRequestException(
          "Certaines commandes sont introuvables ou ne vous appartiennent pas.",
        );
      }

      const alreadyGrouped = orders.filter((o) => o.invoiceGroupId !== null);
      if (alreadyGrouped.length > 0) {
        throw new BadRequestException(
          "Certaines commandes font déjà partie d'un groupe de facturation.",
        );
      }

      // Invoice et InvoiceGroup sont deux tables sans lien : ce contrôle ne
      // voit pas une commande déjà couverte par une facture individuelle.
      // Sans lui, une commande clôturée via POST /orders/:id/close peut être
      // regroupée et refacturée une seconde fois.
      const alreadyInvoiced = await tx.invoice.findMany({
        where: { orderId: { in: dto.orderIds } },
        select: { orderId: true },
      });
      if (alreadyInvoiced.length > 0) {
        throw new BadRequestException(
          "Certaines commandes ont déjà une facture individuelle et ne peuvent pas être groupées.",
        );
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
      orderBy: { createdAt: "desc" },
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
    if (!group) throw new NotFoundException("Groupe introuvable");
    return group;
  }

  async update(id: string, updateInvoiceGroupDto: UpdateInvoiceGroupDto) {
    const { orderIds, ...data } = updateInvoiceGroupDto;
    if (orderIds) {
      throw new BadRequestException(
        "La composition d'un groupe de facturation ne peut pas être modifiée depuis cette route. Supprimez le groupe et recréez-le avec les bonnes commandes.",
      );
    }
    return this.prisma.invoiceGroup.update({
      where: { id },
      data,
    });
  }

  /**
   * remove() détache silencieusement les commandes du groupe (SetNull sur la
   * relation optionnelle) sans le signaler à l'admin. Si l'une d'elles est
   * déjà expédiée, le détachement laisse une commande "Expédié" sans aucune
   * facture — on refuse plutôt que de laisser cette incohérence apparaître.
   */
  async remove(id: string) {
    const group = await this.prisma.invoiceGroup.findUnique({
      where: { id },
      include: { orders: { select: { status: true } } },
    });
    if (!group) throw new NotFoundException("Groupe introuvable");

    const hasShippedOrder = group.orders.some(
      (o) => o.status === OrderStatus.EXPEDIE,
    );
    if (hasShippedOrder) {
      throw new BadRequestException(
        "Ce groupe contient au moins une commande expédiée et ne peut pas être supprimé : ses commandes seraient détachées sans laisser aucune facture.",
      );
    }

    return this.prisma.invoiceGroup.delete({
      where: { id },
    });
  }
}
