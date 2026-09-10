import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { WeightsService } from "../weights/weights.service";
import { BaseMetalType, OrderStatus, TransactionType } from "@prisma/client";

/**
 * Champs de la commande exposés aux écrans "facture".
 *
 * ATTENTION : un `select` imbriqué est une LISTE BLANCHE, contrairement à un
 * `include` qui renvoie tous les scalaires. Retirer `orderNumber` ou `notes`
 * d'ici les fait disparaître de l'API, et le front n'a alors plus rien à
 * afficher — c'est l'origine exacte du bug de numéros de commande signalé par
 * le client. Garder les quatre chemins de lecture sur cette même forme.
 */
const ORDER_SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  notes: true,
  status: true,
  estimatedPrice: true,
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weightsService: WeightsService,
  ) {}

  /**
   * Get all invoices (admin)
   */
  async findAll() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: ORDER_SUMMARY_SELECT },
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
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: ORDER_SUMMARY_SELECT },
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
   *
   * Consommée par client/OrderDetail.tsx : un client lit ici les factures de
   * SA commande. Sans le contrôle ci-dessous, n'importe quel client connecté
   * pouvait lire les factures de n'importe quelle commande en devinant son
   * id — la réponse ne contient pas de champ user, mais amount/fileUrl/notes
   * appartiennent à un autre client. Volontairement sans `include` par
   * ailleurs : cette route n'a pas besoin des infos de commande, déjà
   * chargées séparément par son unique consommateur.
   */
  async findByOrderId(
    orderId: string,
    requestingUser: { id: string; role: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true },
    });
    if (!order) throw new NotFoundException("Commande non trouvée");
    if (
      order.userId !== requestingUser.id &&
      requestingUser.role !== "ADMIN"
    ) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux factures de cette commande",
      );
    }

    return this.prisma.invoice.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Create a new invoice (admin)
   */
  async create(dto: CreateInvoiceDto) {
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: dto.invoiceNumber,
        orderId: dto.orderId || null,
        userId: dto.userId,
        fileUrl: dto.fileUrl,
        amount: dto.amount,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        notes: dto.notes,
      },
      include: {
        order: { select: ORDER_SUMMARY_SELECT },
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
    });

    // Transaction métal optionnelle jointe à la facture (ex: dépôt métal)
    if (dto.metalType && dto.metalWeight) {
      await this.weightsService.addTransactionByUserMetal(
        dto.userId,
        dto.metalType as BaseMetalType,
        {
          type: (dto.metalTransactionType as TransactionType) ?? "CREDIT",
          amount: dto.metalWeight,
          label: `Facture ${dto.invoiceNumber}`,
          date: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        },
      );
    }

    return invoice;
  }

  /**
   * Delete an invoice (admin)
   *
   * Refusé si la suppression aurait un impact réel : une facture émise se
   * conserve normalement 10 ans et se corrige par un avoir, pas par un
   * DELETE (art. L123-22 du Code de commerce). En l'absence de système
   * d'avoir, on bloque au moins les deux cas où la suppression laisserait
   * une incohérence silencieuse en base.
   */
  async delete(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { order: { select: { status: true } } },
    });
    if (!invoice) throw new NotFoundException("Facture non trouvée");

    if (invoice.order?.status === OrderStatus.EXPEDIE) {
      throw new BadRequestException(
        "Cette facture est liée à une commande expédiée et ne peut pas être supprimée : la commande resterait marquée comme expédiée sans aucune facture.",
      );
    }

    // Pas de lien en base entre Invoice et le mouvement de compte poids
    // qu'elle a pu déclencher (closeOrder, ou create() avec un dépôt métal) :
    // les deux inscrivent le numéro de facture dans le libellé de la
    // transaction, c'est le seul repère fiable disponible sans migration.
    const linkedDebit = await this.prisma.transaction.findFirst({
      where: { label: { contains: invoice.invoiceNumber } },
    });
    if (linkedDebit) {
      throw new BadRequestException(
        "Cette facture a déclenché un mouvement sur un compte poids et ne peut pas être supprimée : le mouvement resterait en base sans trace de la facture qui l'a créé.",
      );
    }

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
