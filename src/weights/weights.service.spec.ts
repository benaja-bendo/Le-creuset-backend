import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WeightsService } from "./weights.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  createMockPrismaService,
  fakeMetalAccount,
} from "../common/test-utils";

describe("WeightsService", () => {
  let service: WeightsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [WeightsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WeightsService>(WeightsService);
  });

  describe("getUserAccounts", () => {
    it("should return accounts with last 10 transactions", async () => {
      const accounts = [fakeMetalAccount()];
      prisma.metalAccount.findMany.mockResolvedValue(accounts);

      const result = await service.getUserAccounts("user-1");

      expect(prisma.metalAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1" }),
          include: expect.objectContaining({
            transactions: expect.objectContaining({ take: 10 }),
          }),
        }),
      );
      expect(result).toEqual(accounts);
    });
  });

  describe("getAllAccounts", () => {
    it("should return all accounts sorted by balance asc", async () => {
      prisma.metalAccount.findMany.mockResolvedValue([]);

      await service.getAllAccounts();

      expect(prisma.metalAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { balance: "asc" },
        }),
      );
    });
  });

  describe("initializeUserAccounts", () => {
    it("should create the 3 active metal accounts (no Palladium) for a user", async () => {
      prisma.metalAccount.createMany.mockResolvedValue({ count: 3 });

      const result = await service.initializeUserAccounts("user-1");

      expect(prisma.metalAccount.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ metalType: "OR_FIN", balance: 0 }),
            expect.objectContaining({ metalType: "ARGENT_FIN", balance: 0 }),
            expect.objectContaining({ metalType: "PLATINE", balance: 0 }),
          ]),
        }),
      );
      expect(result).toEqual({ count: 3 });
    });
  });

  describe("addTransaction", () => {
    it("should add a CREDIT transaction and increment the balance atomically", async () => {
      const account = fakeMetalAccount({ balance: 100 });
      const txMock = {
        metalAccount: {
          findUnique: jest.fn().mockResolvedValue(account),
          update: jest.fn().mockResolvedValue({ ...account, balance: 150 }),
        },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.addTransaction("account-1", {
        type: "CREDIT" as any,
        amount: 50,
        label: "Test credit",
      });

      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "CREDIT",
            amount: 50,
          }),
        }),
      );
      // { increment } laisse Postgres calculer le nouveau solde : on ne doit
      // plus jamais lui envoyer une valeur déjà calculée en mémoire.
      expect(txMock.metalAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { increment: 50 } }),
        }),
      );
    });

    it("should add a DEBIT transaction and decrement the balance atomically", async () => {
      const account = fakeMetalAccount({ balance: 100 });
      const txMock = {
        metalAccount: {
          findUnique: jest.fn().mockResolvedValue(account),
          update: jest.fn().mockResolvedValue({ ...account, balance: 70 }),
        },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.addTransaction("account-1", {
        type: "DEBIT" as any,
        amount: 30,
        label: "Test debit",
      });

      expect(txMock.metalAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { increment: -30 } }),
        }),
      );
    });

    it("should throw NotFoundException if account not found", async () => {
      const txMock = {
        metalAccount: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.addTransaction("nonexistent", {
          type: "CREDIT" as any,
          amount: 10,
          label: "test",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("addTransactionByUserMetal", () => {
    it("should upsert the account atomically then add the transaction", async () => {
      const account = fakeMetalAccount({
        id: "account-9",
        userId: "user-1",
        metalType: "OR_FIN",
      });
      prisma.metalAccount.upsert.mockResolvedValue(account);

      const txMock = {
        metalAccount: {
          findUnique: jest.fn().mockResolvedValue(account),
          update: jest.fn().mockResolvedValue({ ...account, balance: 110 }),
        },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.addTransactionByUserMetal("user-1", "OR_FIN" as any, {
        type: "CREDIT" as any,
        amount: 10,
        label: "Dépôt",
      });

      // upsert sur la clé composite : deux dépôts concurrents pour le même
      // client/métal ne peuvent plus créer deux comptes séparés.
      expect(prisma.metalAccount.upsert).toHaveBeenCalledWith({
        where: { userId_metalType: { userId: "user-1", metalType: "OR_FIN" } },
        create: { userId: "user-1", metalType: "OR_FIN", balance: 0 },
        update: {},
      });
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accountId: "account-9" }),
        }),
      );
    });
  });
});
