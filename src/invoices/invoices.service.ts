import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all invoices (admin)
   */
  async findAll() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            estimatedPrice: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Get invoices for a specific user (client)
   */
  async findByUserId(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            estimatedPrice: true,
          },
        },
      },
    });
  }

  /**
   * Get invoice by ID
   */
  async findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        order: true,
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
            phone: true,
            address: true,
          },
        },
      },
    });
  }

  /**
   * Get invoices for a specific order
   */
  async findByOrderId(orderId: string) {
    return this.prisma.invoice.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new invoice (admin)
   */
  async create(dto: CreateInvoiceDto) {
    return this.prisma.invoice.create({
      data: {
        invoiceNumber: dto.invoiceNumber,
        orderId: dto.orderId,
        userId: dto.userId,
        fileUrl: dto.fileUrl,
        amount: dto.amount,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        notes: dto.notes,
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Delete an invoice (admin)
   */
  async delete(id: string) {
    return this.prisma.invoice.delete({
      where: { id },
    });
  }

  /**
   * Count invoices for stats
   */
  async count() {
    return this.prisma.invoice.count();
  }

  /**
   * Count invoices for a user
   */
  async countByUserId(userId: string) {
    return this.prisma.invoice.count({ where: { userId } });
  }
}
