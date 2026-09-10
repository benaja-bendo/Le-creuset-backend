import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { WeightsService } from "../weights/weights.service";
import {
  createMockPrismaService,
  createMockWeightsService,
  fakeInvoice,
} from "../common/test-utils";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: WeightsService, useValue: createMockWeightsService() },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe("findAll", () => {
    it("should return a paginated page of invoices with order and user", async () => {
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);
      prisma.invoice.count.mockResolvedValue(1);

      const result = await service.findAll();

      // Le select imbriqué est une liste blanche : sans assertion sur sa forme,
      // retirer orderNumber ou notes repasserait vert alors que l'API cesse de
      // les renvoyer — c'est exactement la régression signalée par le client.
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          include: expect.objectContaining({
            order: {
              select: expect.objectContaining({
                orderNumber: true,
                notes: true,
              }),
            },
            user: expect.any(Object),
          }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({ items: [fakeInvoice()], total: 1, page: 1, limit: 20 });
    });

    it("should search by invoice number, client, or linked order number", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0);

      await service.findAll({ search: "CMD-123456" });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { order: { orderNumber: { contains: "CMD-123456", mode: "insensitive" } } },
            ]),
          },
        }),
      );
    });
  });

  describe("findAllCombined", () => {
    it("should merge individual and group invoices sorted by date", async () => {
      const oldInvoice = fakeInvoice({
        id: "inv-old",
        createdAt: new Date("2026-01-01"),
      });
      const newGroup = {
        id: "grp-new",
        invoiceNumber: "FAC-GRP-1",
        createdAt: new Date("2026-02-01"),
        orders: [],
        user: { id: "user-1", email: "test@example.com", companyName: "Co" },
      };
      prisma.invoice.findMany.mockResolvedValue([oldInvoice]);
      prisma.invoiceGroup.findMany.mockResolvedValue([newGroup]);
      prisma.invoice.count.mockResolvedValue(1);
      prisma.invoiceGroup.count.mockResolvedValue(1);

      const result = await service.findAllCombined({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.items).toEqual([
        expect.objectContaining({ id: "grp-new", type: "group" }),
        expect.objectContaining({ id: "inv-old", type: "individual" }),
      ]);
    });
  });

  describe("findByUserId", () => {
    it("should return invoices for a specific user", async () => {
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.findByUserId("user-1");

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          include: expect.objectContaining({
            order: {
              select: expect.objectContaining({
                orderNumber: true,
                notes: true,
              }),
            },
          }),
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return invoice with order and user", async () => {
      prisma.invoice.findUnique.mockResolvedValue(fakeInvoice());

      await service.findById("invoice-1");

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "invoice-1" },
          include: expect.objectContaining({ order: true }),
        }),
      );
    });
  });

  describe("findByOrderId", () => {
    it("should return invoices when the requester owns the order", async () => {
      prisma.order.findUnique.mockResolvedValue({ userId: "user-1" });
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);

      await service.findByOrderId("order-1", {
        id: "user-1",
        role: "CLIENT",
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: "order-1" },
        }),
      );
    });

    it("should allow an admin to read invoices for any order", async () => {
      prisma.order.findUnique.mockResolvedValue({ userId: "someone-else" });
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);

      await expect(
        service.findByOrderId("order-1", { id: "admin-1", role: "ADMIN" }),
      ).resolves.toEqual([fakeInvoice()]);
    });

    it("should reject a client who does not own the order", async () => {
      prisma.order.findUnique.mockResolvedValue({ userId: "someone-else" });

      await expect(
        service.findByOrderId("order-1", { id: "user-1", role: "CLIENT" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if the order does not exist", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.findByOrderId("nonexistent", {
          id: "user-1",
          role: "CLIENT",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create an invoice", async () => {
      prisma.invoice.create.mockResolvedValue(fakeInvoice());

      const dto = {
        invoiceNumber: "INV-001",
        orderId: "order-1",
        userId: "user-1",
        fileUrl: "/invoice.pdf",
        amount: 100,
      };

      const result = await service.create(dto);

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: "INV-001",
            orderId: "order-1",
          }),
        }),
      );
      expect(result).toEqual(fakeInvoice());
    });
  });

  describe("delete", () => {
    it("should delete an invoice with no linked order or weight movement", async () => {
      prisma.invoice.findUnique.mockResolvedValue(fakeInvoice({ order: null }));
      prisma.transaction.findFirst.mockResolvedValue(null);
      prisma.invoice.delete.mockResolvedValue(fakeInvoice());

      await service.delete("invoice-1");

      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: "invoice-1" },
      });
    });

    it("should throw NotFoundException if invoice not found", async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.delete("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should reject deleting an invoice linked to a shipped order", async () => {
      prisma.invoice.findUnique.mockResolvedValue(
        fakeInvoice({ order: { status: "EXPEDIE" } }),
      );

      await expect(service.delete("invoice-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
    });

    it("should reject deleting an invoice that triggered a weight movement", async () => {
      prisma.invoice.findUnique.mockResolvedValue(
        fakeInvoice({ invoiceNumber: "INV-042", order: null }),
      );
      prisma.transaction.findFirst.mockResolvedValue({
        id: "tx-1",
        label: "Facture INV-042",
      });

      await expect(service.delete("invoice-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
    });
  });

  describe("count", () => {
    it("should return total invoice count", async () => {
      prisma.invoice.count.mockResolvedValue(5);

      const result = await service.count();

      expect(result).toBe(5);
    });
  });

  describe("countByUserId", () => {
    it("should return invoice count for a user", async () => {
      prisma.invoice.count.mockResolvedValue(2);

      const result = await service.countByUserId("user-1");

      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
      expect(result).toBe(2);
    });
  });
});
