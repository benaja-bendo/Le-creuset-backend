import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { orderReference } from "../common/order-ref";
import { OrderStatus, TransactionType, MetalType } from "@prisma/client";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        invoices: {
          select: { id: true, invoiceNumber: true },
        },
      },
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
        invoices: {
          select: { id: true, invoiceNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: {
    userId: string;
    stlFileUrl?: string;
    estimatedPrice?: number;
    materialType?: MetalType;
    notes?: string;
  }) {
    const generatedOrderNumber = `CMD-${Date.now().toString().slice(-6)}`;
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        status: OrderStatus.EN_ATTENTE,
        stlFileUrl: data.stlFileUrl,
        estimatedPrice: data.estimatedPrice,
        materialType: data.materialType,
        notes: data.notes,
        orderNumber: generatedOrderNumber,
      },
    });
  }

  async createManual(data: {
    userId: string;
    estimatedPrice?: number;
    materialType?: string;
    notes?: string;
    orderNumber?: string;
  }) {
    const generatedOrderNumber =
      data.orderNumber || `CMD-${Date.now().toString().slice(-6)}`;
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        status: OrderStatus.EN_ATTENTE,
        estimatedPrice: data.estimatedPrice,
        materialType: data.materialType as MetalType,
        notes: data.notes,
        isManualOrder: true,
        orderNumber: generatedOrderNumber,
      },
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Commande non trouvée");

    // EXPEDIE ne se pose que via closeOrder (facture + débit poids + email
    // dans la même transaction). Un simple changement de statut laisserait la
    // commande "expédiée" sans rien de tout ça, et masquerait ensuite le vrai
    // bouton de clôture côté front (qui se cache dès que status === EXPEDIE).
    if (status === OrderStatus.EXPEDIE) {
      throw new BadRequestException(
        "Le statut EXPEDIE ne peut être atteint que via la clôture de commande (POST /orders/:id/close).",
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        // `include: { user: true }` renvoyait tous les scalaires de User —
        // passwordHash, address, kbisFileUrl, customsFileUrl compris —
        // jusqu'au client connecté via GET /orders/:id. Liste blanche
        // explicite, alignée sur ce que consomment admin/OrderDetail.tsx et
        // client/OrderDetail.tsx.
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
            phone: true,
          },
        },
        invoices: true,
      },
    });
  }

  async update(
    id: string,
    data: { materialType?: MetalType; notes?: string; stlFileUrl?: string },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Commande non trouvée");

    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Commande non trouvée");

    // Delete related invoices first
    await this.prisma.invoice.deleteMany({ where: { orderId: id } });

    return this.prisma.order.delete({ where: { id } });
  }

  /**
   * Close an order: create invoice, update status, optionally debit weight account
   * Returns the order and invoice for notification handling in controller
   */
  async closeOrder(
    orderId: string,
    data: {
      invoiceNumber: string;
      invoiceFileUrl: string;
      finalAmount?: number;
      finalWeight?: number;
      debitWeightAccount?: boolean;
      metalType?: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) throw new NotFoundException("Commande non trouvée");
    if (order.status === OrderStatus.EXPEDIE) {
      throw new BadRequestException(
        "Cette commande a déjà été clôturée : une facture et, le cas échéant, un débit poids existent déjà.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          orderId: orderId,
          userId: order.userId,
          fileUrl: data.invoiceFileUrl,
          amount: data.finalAmount,
          issueDate: new Date(),
        },
      });

      // 2. Update order status to EXPEDIE
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.EXPEDIE,
          estimatedPrice: data.finalAmount,
        },
      });

      if (data.debitWeightAccount && data.finalWeight && data.metalType) {
        // Here we map the order's metal alloy to its base pure metal for the weight account
        let baseMetal: import("@prisma/client").BaseMetalType | null = null;
        const mt = data.metalType;

        if (mt.includes("OR_")) baseMetal = "OR_FIN";
        else if (mt.includes("ARGENT_")) baseMetal = "ARGENT_FIN";
        else if (mt.includes("PLATINE_")) baseMetal = "PLATINE";
        else if (mt.includes("PALLADIUM")) baseMetal = "PALLADIUM";

        if (baseMetal) {
          const account = await tx.metalAccount.findFirst({
            where: { userId: order.userId, metalType: baseMetal },
          });

          if (account) {
            // Create debit transaction
            await tx.transaction.create({
              data: {
                accountId: account.id,
                type: TransactionType.DEBIT,
                amount: data.finalWeight,
                // Libellé persisté en base : on utilise le numéro de commande
                // métier, pas la queue du cuid, sinon le client lit dans son
                // historique de compte poids une référence qui n'existe pas.
                label: `Commande ${orderReference(order)} - ${data.invoiceNumber}`,
                date: new Date(),
              },
            });

            // Update account balance — decrement atomique (UPDATE ... SET
            // balance = balance - x côté Postgres) plutôt que de réécrire une
            // valeur calculée depuis le solde lu plus haut, qui perdrait un
            // mouvement concurrent sur le même compte.
            await tx.metalAccount.update({
              where: { id: account.id },
              data: {
                balance: { decrement: data.finalWeight },
                lastUpdate: new Date(),
              },
            });
          }
        }
      }

      return {
        order: { ...updatedOrder, user: order.user },
        invoice,
      };
    });
  }
}
