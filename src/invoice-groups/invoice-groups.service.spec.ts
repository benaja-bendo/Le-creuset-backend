import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { InvoiceGroupsService } from "./invoice-groups.service";
import { PrismaService } from "../prisma/prisma.service";
import { createMockPrismaService, fakeOrder } from "../common/test-utils";

describe("InvoiceGroupsService", () => {
  let service: InvoiceGroupsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceGroupsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoiceGroupsService>(InvoiceGroupsService);
  });

  describe("create", () => {
    const dto = {
      orderIds: ["order-1", "order-2"],
      invoiceNumber: "GRP-001",
      userId: "user-1",
      fileUrl: "/group.pdf",
      amount: 1000,
      notes: "test",
    };

    it("should create an invoice group and link orders", async () => {
      const orders = [
        fakeOrder({ id: "order-1", userId: "user-1", invoiceGroupId: null }),
        fakeOrder({ id: "order-2", userId: "user-1", invoiceGroupId: null }),
      ];
      const group = { id: "group-1", ...dto, orders };

      const txMock = {
        order: {
          findMany: jest.fn().mockResolvedValue(orders),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        invoice: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        invoiceGroup: {
          create: jest.fn().mockResolvedValue({ id: "group-1" }),
          findUnique: jest.fn().mockResolvedValue(group),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      const result = await service.create(dto as any);

      expect(txMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: dto.orderIds }, userId: dto.userId },
        }),
      );
      expect(txMock.invoiceGroup.create).toHaveBeenCalled();
      expect(txMock.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: dto.orderIds } },
          data: { invoiceGroupId: "group-1" },
        }),
      );
      expect(result).toEqual(group);
    });

    it("should use the requested issueDate instead of the creation date", async () => {
      const orders = [
        fakeOrder({ id: "order-1", userId: "user-1", invoiceGroupId: null }),
        fakeOrder({ id: "order-2", userId: "user-1", invoiceGroupId: null }),
      ];
      const txMock = {
        order: {
          findMany: jest.fn().mockResolvedValue(orders),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        invoice: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        invoiceGroup: {
          create: jest.fn().mockResolvedValue({ id: "group-1" }),
          findUnique: jest.fn().mockResolvedValue({ id: "group-1" }),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.create({ ...dto, issueDate: "2026-01-15" } as any);

      expect(txMock.invoiceGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ issueDate: new Date("2026-01-15") }),
        }),
      );
    });

    it("should throw BadRequestException if some orders not found", async () => {
      const txMock = {
        order: {
          findMany: jest.fn().mockResolvedValue([fakeOrder({ id: "order-1" })]),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if orders are already grouped", async () => {
      const orders = [
        fakeOrder({ id: "order-1", invoiceGroupId: null }),
        fakeOrder({ id: "order-2", invoiceGroupId: "existing-group" }),
      ];
      const txMock = {
        order: { findMany: jest.fn().mockResolvedValue(orders) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if an order already has an individual invoice", async () => {
      // Invoice et InvoiceGroup n'ont aucun lien : une commande déjà facturée
      // individuellement (via POST /orders/:id/close) doit rester bloquée au
      // groupement, sinon elle se retrouve facturée deux fois.
      const orders = [
        fakeOrder({ id: "order-1", invoiceGroupId: null }),
        fakeOrder({ id: "order-2", invoiceGroupId: null }),
      ];
      const txMock = {
        order: { findMany: jest.fn().mockResolvedValue(orders) },
        invoice: {
          findMany: jest.fn().mockResolvedValue([{ orderId: "order-1" }]),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should turn a duplicate invoice number into a clear error", async () => {
      const orders = [
        fakeOrder({ id: "order-1", userId: "user-1", invoiceGroupId: null }),
        fakeOrder({ id: "order-2", userId: "user-1", invoiceGroupId: null }),
      ];
      const conflict = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.0.0",
          meta: { target: ["invoiceNumber"] },
        },
      );
      const txMock = {
        order: { findMany: jest.fn().mockResolvedValue(orders) },
        invoice: { findMany: jest.fn().mockResolvedValue([]) },
        invoiceGroup: { create: jest.fn().mockRejectedValue(conflict) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("suggestNextInvoiceGroupNumber", () => {
    it("should suggest 0001 for the year when no group exists yet", async () => {
      prisma.invoiceGroup.findFirst.mockResolvedValue(null);

      const result = await service.suggestNextInvoiceGroupNumber();

      const year = new Date().getFullYear();
      expect(result).toBe(`FAC-GRP-${year}-0001`);
      expect(prisma.invoiceGroup.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceNumber: { startsWith: `FAC-GRP-${year}-` } },
          orderBy: { invoiceNumber: "desc" },
        }),
      );
    });

    it("should increment the latest group invoice number for the year", async () => {
      const year = new Date().getFullYear();
      prisma.invoiceGroup.findFirst.mockResolvedValue({
        invoiceNumber: `FAC-GRP-${year}-0003`,
      });

      const result = await service.suggestNextInvoiceGroupNumber();

      expect(result).toBe(`FAC-GRP-${year}-0004`);
    });
  });

  describe("findAll", () => {
    it("should return all groups with user and orders", async () => {
      prisma.invoiceGroup.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.invoiceGroup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: expect.any(Object),
            orders: true,
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return a group by id", async () => {
      const group = { id: "group-1", orders: [] };
      prisma.invoiceGroup.findUnique.mockResolvedValue(group);

      const result = await service.findOne("group-1");

      expect(result).toEqual(group);
    });

    it("should throw NotFoundException if not found", async () => {
      prisma.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update an invoice group", async () => {
      prisma.invoiceGroup.update.mockResolvedValue({
        id: "group-1",
        notes: "updated",
      });

      const result = await service.update("group-1", {
        notes: "updated",
      } as any);

      expect(prisma.invoiceGroup.update).toHaveBeenCalledWith({
        where: { id: "group-1" },
        data: { notes: "updated" },
      });
      expect(result.notes).toBe("updated");
    });

    it("should reject a change to orderIds — composition not editable here", async () => {
      await expect(
        service.update("group-1", { orderIds: ["order-9"] } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.invoiceGroup.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete an invoice group with no shipped order", async () => {
      prisma.invoiceGroup.findUnique.mockResolvedValue({
        id: "group-1",
        orders: [{ status: "TIRAGE_OK" }, { status: "FONDU" }],
      });
      prisma.invoiceGroup.delete.mockResolvedValue({ id: "group-1" });

      await service.remove("group-1");

      expect(prisma.invoiceGroup.delete).toHaveBeenCalledWith({
        where: { id: "group-1" },
      });
    });

    it("should throw NotFoundException if group not found", async () => {
      prisma.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(service.remove("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should reject deleting a group containing a shipped order", async () => {
      prisma.invoiceGroup.findUnique.mockResolvedValue({
        id: "group-1",
        orders: [{ status: "TIRAGE_OK" }, { status: "EXPEDIE" }],
      });

      await expect(service.remove("group-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.invoiceGroup.delete).not.toHaveBeenCalled();
    });
  });
});
