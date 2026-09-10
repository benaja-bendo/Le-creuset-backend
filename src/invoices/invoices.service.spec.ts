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
    it("should return all invoices with order and user", async () => {
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);

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
        }),
      );
      expect(result).toHaveLength(1);
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
