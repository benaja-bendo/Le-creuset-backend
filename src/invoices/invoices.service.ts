import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { WeightsService } from "../weights/weights.service";
import { suggestNextNumber } from "../common/sequence-number";
import { rethrowUniqueConstraint } from "../common/prisma-errors";
import {
  BaseMetalType,
  OrderStatus,
  Prisma,
  TransactionType,
} from "@prisma/client";

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
   * Get all invoices (admin), paginée. `search` couvre le numéro de facture,
   * la raison sociale/email du client, et le numéro de la commande liée — ce
   * dernier manquait dans le filtre en mémoire côté front (facture de
   * `CMD-123456` introuvable autrement qu'à l'œil).
   */
  async findAll(
    query: { page?: number; limit?: number; search?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.buildInvoiceSearchWhere(query.search);

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private buildInvoiceSearchWhere(search?: string): Prisma.InvoiceWhereInput {
    const term = search?.trim();
    if (!term) return {};
    return {
      OR: [
        { invoiceNumber: { contains: term, mode: "insensitive" } },
        { user: { companyName: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
        { order: { orderNumber: { contains: term, mode: "insensitive" } } },
      ],
    };
  }

  private buildInvoiceGroupSearchWhere(
    search?: string,
  ): Prisma.InvoiceGroupWhereInput {
    const term = search?.trim();
    if (!term) return {};
    return {
      OR: [
        { invoiceNumber: { contains: term, mode: "insensitive" } },
        { user: { companyName: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
        {
          orders: {
            some: { orderNumber: { contains: term, mode: "insensitive" } },
          },
        },
      ],
    };
  }

  /**
   * Vue combinée factures individuelles + groupées consommée par
   * admin/Invoices.tsx, qui les fusionne en une seule liste triée par date.
   * Aucune requête SQL ne trie nativement deux tables ensemble : on prend
   * les `page * limit` lignes les plus récentes de CHAQUE table (suffisant
   * pour garantir que la page demandée, une fois fusionnée et triée, est
   * correcte), on fusionne en mémoire, puis on découpe. Le coût croît avec
   * la profondeur de page — comme toute pagination par offset — mais jamais
   * en chargeant les deux tables en entier.
   */
  async findAllCombined(
    query: { page?: number; limit?: number; search?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const fetchDepth = page * limit;

    const invoiceWhere = this.buildInvoiceSearchWhere(query.search);
    const groupWhere = this.buildInvoiceGroupSearchWhere(query.search);

    const [invoices, groups, totalInvoices, totalGroups] = await Promise.all([
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        orderBy: { createdAt: "desc" },
        take: fetchDepth,
        include: {
          order: { select: ORDER_SUMMARY_SELECT },
          user: { select: { id: true, email: true, companyName: true } },
        },
      }),
      this.prisma.invoiceGroup.findMany({
        where: groupWhere,
        orderBy: { createdAt: "desc" },
        take: fetchDepth,
        include: {
          orders: { select: ORDER_SUMMARY_SELECT },
          user: { select: { id: true, email: true, companyName: true } },
        },
      }),
      this.prisma.invoice.count({ where: invoiceWhere }),
      this.prisma.invoiceGroup.count({ where: groupWhere }),
    ]);

    const merged = [
      ...invoices.map((invoice) => ({
        ...invoice,
        type: "individual" as const,
      })),
      ...groups.map((group) => ({ ...group, type: "group" as const })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (page - 1) * limit;

    return {
      items: merged.slice(start, start + limit),
      total: totalInvoices + totalGroups,
      page,
      limit,
    };
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
    if (order.userId !== requestingUser.id && requestingUser.role !== "ADMIN") {
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
   * Create a new invoice (admin). La facture et le dépôt métal optionnel
   * qui l'accompagne sont créés dans la MÊME transaction : avant, un
   * échec du second appel laissait la facture exister sans son dépôt
   * métal, sans aucune trace de l'échec.
   */
  async create(dto: CreateInvoiceDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
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
            tx,
          );
        }

        return invoice;
      });
    } catch (err) {
      rethrowUniqueConstraint(
        err,
        "invoiceNumber",
        `Le numéro de facture "${dto.invoiceNumber}" existe déjà. Réessayez.`,
      );
    }
  }

  /**
   * Suggestion pour pré-remplir le champ numéro de facture côté front —
   * jusqu'ici saisi à la main sans aide. Lecture seule : voir
   * `suggestNextNumber`.
   */
  async suggestNextInvoiceNumber(): Promise<string> {
    return suggestNextNumber(async (yearPrefix) => {
      const last = await this.prisma.invoice.findFirst({
        where: { invoiceNumber: { startsWith: yearPrefix } },
        orderBy: { invoiceNumber: "desc" },
        select: { invoiceNumber: true },
      });
      return last?.invoiceNumber;
    }, "FAC");
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
