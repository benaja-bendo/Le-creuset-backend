import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetalType, TransactionType } from '@prisma/client';

@Injectable()
export class WeightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all metal accounts for a specific user with their last transactions
   */
  async getUserAccounts(userId: string) {
    return this.prisma.metalAccount.findMany({
      where: { userId },
      include: {
        transactions: {
          take: 10,
          orderBy: { date: 'desc' },
        },
      },
    });
  }

  /**
   * Get all accounts for admin view, typically sorted by debt
   */
  async getAllAccounts() {
    return this.prisma.metalAccount.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            companyName: true,
          },
        },
      },
      orderBy: { balance: 'asc' }, // Shows negative balances first (clients who owe metal)
    });
  }

  /**
   * Initialize accounts for a new user
   */
  async initializeUserAccounts(userId: string) {
    const metalTypes = Object.values(MetalType);
    const data = metalTypes.map((type) => ({
      userId,
      metalType: type,
      balance: 0,
    }));

    return this.prisma.metalAccount.createMany({
      data,
    });
  }

  /**
   * Add a transaction to a metal account and update its balance
   */
  async addTransaction(accountId: string, data: {
    type: TransactionType;
    amount: number;
    label: string;
    date?: Date;
  }) {
    const account = await this.prisma.metalAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new NotFoundException('Compte métal non trouvé');

    const amount = Number(data.amount);
    const newBalance = data.type === TransactionType.CREDIT 
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
}
