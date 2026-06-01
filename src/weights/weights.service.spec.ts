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
          where: { userId: "user-1" },
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
    it("should create 4 metal accounts for a user", async () => {
      prisma.metalAccount.createMany.mockResolvedValue({ count: 4 });

      const result = await service.initializeUserAccounts("user-1");

      expect(prisma.metalAccount.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ metalType: "OR_FIN", balance: 0 }),
            expect.objectContaining({ metalType: "ARGENT_FIN", balance: 0 }),
            expect.objectContaining({ metalType: "PLATINE", balance: 0 }),
            expect.objectContaining({ metalType: "PALLADIUM", balance: 0 }),
          ]),
        }),
      );
      expect(result).toEqual({ count: 4 });
    });
  });

  describe("addTransaction", () => {
    it("should add a CREDIT transaction and increase balance", async () => {
      const account = fakeMetalAccount({ balance: 100 });
      prisma.metalAccount.findUnique.mockResolvedValue(account);

      // Mock the $transaction to execute its callback with a separate tx mock
      const txMock = {
        transaction: { create: jest.fn().mockResolvedValue({}) },
        metalAccount: {
          update: jest.fn().mockResolvedValue({ ...account, balance: 150 }),
        },
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
      expect(txMock.metalAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: 150 }),
        }),
      );
    });

    it("should add a DEBIT transaction and decrease balance", async () => {
      const account = fakeMetalAccount({ balance: 100 });
      prisma.metalAccount.findUnique.mockResolvedValue(account);

      const txMock = {
        transaction: { create: jest.fn().mockResolvedValue({}) },
        metalAccount: {
          update: jest.fn().mockResolvedValue({ ...account, balance: 70 }),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.addTransaction("account-1", {
        type: "DEBIT" as any,
        amount: 30,
        label: "Test debit",
      });

      expect(txMock.metalAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: 70 }),
        }),
      );
    });

    it("should throw NotFoundException if account not found", async () => {
      prisma.metalAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.addTransaction("nonexistent", {
          type: "CREDIT" as any,
          amount: 10,
          label: "test",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
