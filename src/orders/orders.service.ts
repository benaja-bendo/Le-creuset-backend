import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { orderReference } from "../common/order-ref";
import { suggestNextNumber } from "../common/sequence-number";
import { rethrowUniqueConstraint } from "../common/prisma-errors";
import { OrderStatus, TransactionType, MetalType, Prisma } from "@prisma/client";

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

  async findAll(query: { page?: number; limit?: number; status?: string } = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // Le filtre de statut vivait côté front (sur les seules commandes déjà
    // chargées) : une fois la liste paginée, filtrer après coup ne verrait
    // que la page courante et cacherait des résultats bien réels d'autres
    // pages. Il doit passer côté serveur en même temps que la pagination.
    const where: Prisma.OrderWhereInput = query.status
      ? { status: query.status as OrderStatus }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async createManual(data: {
    userId: string;
    estimatedPrice?: number;
    materialType?: MetalType;
    notes?: string;
    orderNumber?: string;
    quantity?: number;
  }) {
    if (
      data.quantity !== undefined &&
      (!Number.isInteger(data.quantity) || data.quantity < 1)
    ) {
      throw new BadRequestException(
        "La quantité doit être un nombre entier positif.",
      );
    }

    const generatedOrderNumber =
      data.orderNumber || (await this.suggestNextOrderNumber());
    try {
      return await this.prisma.order.create({
        data: {
          userId: data.userId,
          status: OrderStatus.EN_ATTENTE,
          estimatedPrice: data.estimatedPrice,
          materialType: data.materialType,
          notes: data.notes,
          isManualOrder: true,
          orderNumber: generatedOrderNumber,
          quantity: data.quantity,
        },
      });
    } catch (err) {
      rethrowUniqueConstraint(
        err,
        "orderNumber",
        `Le numéro de commande "${generatedOrderNumber}" existe déjà. Réessayez.`,
      );
    }
  }

  /**
   * Suggestion pour pré-remplir le champ numéro de commande côté front —
   * remplace l'ancien `CMD-${Date.now()...}`, qui ne garantissait ni
   * continuité ni absence de collision. Lecture seule : voir
   * `suggestNextNumber`.
   */
  async suggestNextOrderNumber(): Promise<string> {
    return suggestNextNumber(async (yearPrefix) => {
      const last = await this.prisma.order.findFirst({
        where: { orderNumber: { startsWith: yearPrefix } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      return last?.orderNumber;
    }, "CMD");
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
    data: {
      materialType?: MetalType;
      notes?: string;
      stlFileUrl?: string;
      quantity?: number;
    },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Commande non trouvée");

    if (
      data.quantity !== undefined &&
      (!Number.isInteger(data.quantity) || data.quantity < 1)
    ) {
      throw new BadRequestException(
        "La quantité doit être un nombre entier positif.",
      );
    }

    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  /**
   * Refusé si la commande a une facture (individuelle ou via un groupe) :
   * l'ancien comportement supprimait les factures liées AVANT la commande,
   * sans confirmation dédiée — un débit de compte poids créé à la clôture
   * restait en base sans plus aucune trace de la facture qui l'avait
   * déclenché. Même logique que le refus de suppression de facture (§1.3).
   */
  async delete(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException("Commande non trouvée");

    const invoiceCount = await this.prisma.invoice.count({
      where: { orderId: id },
    });
    if (invoiceCount > 0 || order.invoiceGroupId) {
      throw new BadRequestException(
        "Cette commande est liée à une facture et ne peut pas être supprimée : la facture perdrait toute référence à la commande, et un éventuel débit de compte poids resterait en base sans lien vers elle. Supprimez d'abord la facture si nécessaire.",
      );
    }

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

      // Le DTO garantit déjà finalWeight+metalType présents dès que
      // debitWeightAccount est coché — reste à vérifier qu'ils désignent
      // bien un compte réel. Avant, un métal non reconnu ou un compte
      // manquant laissait la clôture "réussir" sans débiter, sans un mot.
      if (data.debitWeightAccount) {
        // Re-vérifié ici (pas seulement dans le DTO) : closeOrder() est une
        // méthode de service publique, appelable hors du contrôleur HTTP —
        // le refine Zod ne la protège pas dans ce cas.
        if (!data.finalWeight) {
          throw new BadRequestException(
            "Le poids réel est requis pour débiter le compte poids.",
          );
        }
        const mt = data.metalType as string;
        let baseMetal: import("@prisma/client").BaseMetalType | null = null;

        if (mt.includes("OR_")) baseMetal = "OR_FIN";
        else if (mt.includes("ARGENT_")) baseMetal = "ARGENT_FIN";
        else if (mt.includes("PLATINE_")) baseMetal = "PLATINE";
        else if (mt.includes("PALLADIUM")) baseMetal = "PALLADIUM";

        if (!baseMetal) {
          throw new BadRequestException(
            `Type de métal "${mt}" non reconnu : impossible de déterminer le compte poids à débiter.`,
          );
        }

        const account = await tx.metalAccount.findFirst({
          where: { userId: order.userId, metalType: baseMetal },
        });

        if (!account) {
          throw new BadRequestException(
            `Le client n'a pas de compte poids ${baseMetal} : impossible de débiter. Vérifiez que son compte est actif.`,
          );
        }

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

      return {
        order: { ...updatedOrder, user: order.user },
        invoice,
      };
    });
  }
}
