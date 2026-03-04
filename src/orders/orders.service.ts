import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, TransactionType, MetalType } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { userId: string; stlFileUrl?: string; estimatedPrice?: number; materialType?: MetalType; notes?: string }) {
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        status: OrderStatus.EN_ATTENTE,
        stlFileUrl: data.stlFileUrl,
        estimatedPrice: data.estimatedPrice,
        materialType: data.materialType,
        notes: data.notes,
      },
    });
  }

  async createManual(data: { userId: string; estimatedPrice?: number; materialType?: string; notes?: string }) {
    return this.prisma.order.create({
      data: {
        userId: data.userId,
        status: OrderStatus.EN_ATTENTE,
        estimatedPrice: data.estimatedPrice,
        materialType: data.materialType as MetalType,
        notes: data.notes,
        isManualOrder: true,
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
      include: { 
        user: true,
        invoices: true,
      },
    });
  }

  /**
   * Close an order: create invoice, update status, optionally debit weight account
   * Returns the order and invoice for notification handling in controller
   */
  async closeOrder(orderId: string, data: {
    invoiceNumber: string;
    invoiceFileUrl: string;
    finalAmount?: number;
    finalWeight?: number;
    debitWeightAccount?: boolean;
    metalType?: string;
  }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) throw new NotFoundException('Commande non trouvée');

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
        let baseMetal: import('@prisma/client').BaseMetalType | null = null;
        const mt = data.metalType;
        
        if (mt.includes('OR_')) baseMetal = 'OR_FIN';
        else if (mt.includes('ARGENT_')) baseMetal = 'ARGENT_FIN';
        else if (mt.includes('PLATINE_')) baseMetal = 'PLATINE';
        else if (mt.includes('PALLADIUM')) baseMetal = 'PALLADIUM';

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
                label: `Commande #${orderId.slice(-6)} - ${data.invoiceNumber}`,
                date: new Date(),
              },
            });

            // Update account balance
            await tx.metalAccount.update({
              where: { id: account.id },
              data: {
                balance: Number(account.balance) - data.finalWeight,
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
