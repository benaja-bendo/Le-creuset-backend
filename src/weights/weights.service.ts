import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BaseMetalType, TransactionType } from "@prisma/client";

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
   * Get all accounts for admin view, typically sorted by debt
   */
  async getAllAccounts() {
    return this.prisma.metalAccount.findMany({
      where: { metalType: { in: ACTIVE_BASE_METALS } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { balance: "asc" }, // Shows negative balances first (clients who owe metal)
    });
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
    let account = await this.prisma.metalAccount.findFirst({
      where: { userId, metalType },
    });

    if (!account) {
      account = await this.prisma.metalAccount.create({
        data: { userId, metalType, balance: 0 },
      });
    }

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
    const account = await this.prisma.metalAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException("Compte métal non trouvé");

    const amount = Number(data.amount);
    const newBalance =
      data.type === TransactionType.CREDIT
        ? Number(account.balance) + amount
        : Number(account.balance) - amount;

    return this.prisma.$transaction(async (tx) => {
      // Create transaction record
      await tx.transaction.create({
        data: {
          accountId,
          type: data.type,
          amount: amount,
          label: data.label,
          date: data.date || new Date(),
        },
      });

      // Update account balance
      return tx.metalAccount.update({
        where: { id: accountId },
        data: {
          balance: newBalance,
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
