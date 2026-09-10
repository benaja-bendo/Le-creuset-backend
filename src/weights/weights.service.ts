import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BaseMetalType, Prisma, TransactionType } from "@prisma/client";

// Métaux purs gérés sur les comptes poids.
// Le Palladium a été retiré de la liste à la demande du client : on n'initialise
// plus de compte Palladium et on masque les éventuels comptes existants.
export const ACTIVE_BASE_METALS: BaseMetalType[] = [
  BaseMetalType.OR_FIN,
  BaseMetalType.ARGENT_FIN,
  BaseMetalType.PLATINE,
];

@Injectable()
export class WeightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all metal accounts for a specific user with their last transactions
   */
  async getUserAccounts(userId: string) {
    return this.prisma.metalAccount.findMany({
      where: { userId, metalType: { in: ACTIVE_BASE_METALS } },
      include: {
        transactions: {
          take: 10,
          orderBy: { date: "desc" },
        },
      },
    });
  }

  /**
   * Get all accounts for admin view, paginée par CLIENT (pas par ligne de
   * compte) : un client a jusqu'à 3 comptes (un par métal actif), et couper
   * une page au milieu d'un client casserait l'affichage groupé du front.
   * On paginate donc sur les utilisateurs ayant au moins un compte actif,
   * puis on récupère leurs comptes.
   *
   * Compromis assumé : le tri "dettes d'abord" du front (comptes à solde
   * négatif remontés en tête) se faisait sur la liste complète ; il ne
   * s'applique plus qu'à l'intérieur de chaque page, pas globalement sur
   * tout le client. Reproduire un tri global par dette en SQL demanderait un
   * agrégat sur la relation (raw SQL) pour un gain marginal — cette
   * business a un nombre de clients borné, pas un flux de transactions.
   */
  async getAllAccounts(
    query: { page?: number; limit?: number; search?: string } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const term = query.search?.trim();

    const userWhere: Prisma.UserWhereInput = {
      metalAccounts: { some: { metalType: { in: ACTIVE_BASE_METALS } } },
      ...(term
        ? {
            OR: [
              { companyName: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [userIds, total] = await Promise.all([
      this.prisma.user.findMany({
        where: userWhere,
        select: { id: true },
        orderBy: [{ companyName: "asc" }, { email: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where: userWhere }),
    ]);

    const items = await this.prisma.metalAccount.findMany({
      where: {
        userId: { in: userIds.map((u) => u.id) },
        metalType: { in: ACTIVE_BASE_METALS },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { balance: "asc" },
    });

    return { items, total, page, limit };
  }

  /**
   * Initialize accounts for a new user
   */
  async initializeUserAccounts(userId: string) {
    const data = ACTIVE_BASE_METALS.map((type) => ({
      userId,
      metalType: type,
      balance: 0,
    }));

    return this.prisma.metalAccount.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * Ajoute un mouvement sur le compte (userId + métal de base), en créant le
   * compte si nécessaire. Utilisé notamment lors du dépôt d'une facture / dépôt métal.
   */
  async addTransactionByUserMetal(
    userId: string,
    metalType: BaseMetalType,
    data: {
      type: TransactionType;
      amount: number;
      label: string;
      date?: Date;
    },
  ) {
    // upsert atomique : le findFirst+create précédent laissait une fenêtre où
    // deux appels concurrents (ex. deux dépôts de facture au même moment)
    // pouvaient chacun ne rien trouver et créer deux comptes pour le même
    // métal. La contrainte @@unique([userId, metalType]) rend ça impossible.
    const account = await this.prisma.metalAccount.upsert({
      where: { userId_metalType: { userId, metalType } },
      create: { userId, metalType, balance: 0 },
      update: {},
    });

    return this.addTransaction(account.id, data);
  }

  /**
   * Add a transaction to a metal account and update its balance
   */
  async addTransaction(
    accountId: string,
    data: {
      type: TransactionType;
      amount: number;
      label: string;
      date?: Date;
    },
  ) {
    const amount = Number(data.amount);
    // { increment/decrement } se traduit par un UPDATE ... SET balance =
    // balance ± x côté Postgres : deux mouvements concurrents sur le même
    // compte s'additionnent correctement. Lire le solde puis réécrire une
    // valeur calculée en mémoire (comme avant) perd l'un des deux si les
    // écritures se chevauchent.
    const delta = data.type === TransactionType.CREDIT ? amount : -amount;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.metalAccount.findUnique({
        where: { id: accountId },
      });
      if (!account) throw new NotFoundException("Compte métal non trouvé");

      await tx.transaction.create({
        data: {
          accountId,
          type: data.type,
          amount,
          label: data.label,
          date: data.date || new Date(),
        },
      });

      return tx.metalAccount.update({
        where: { id: accountId },
        data: {
          balance: { increment: delta },
          lastUpdate: new Date(),
        },
      });
    });
  }

  /**
   * Find metal account by user ID and base metal type
   */
  async findAccountByUserAndMetal(userId: string, metalType: BaseMetalType) {
    return this.prisma.metalAccount.findFirst({
      where: { userId, metalType },
    });
  }
}
