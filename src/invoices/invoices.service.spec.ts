import { Test, TestingModule } from "@nestjs/testing";
import { InvoicesService } from "./invoices.service";
import { PrismaService } from "../prisma/prisma.service";
import { createMockPrismaService, fakeInvoice } from "../common/test-utils";

describe("InvoicesService", () => {
  let service: InvoicesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe("findAll", () => {
    it("should return all invoices with order and user", async () => {
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);

      const result = await service.findAll();

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
          include: expect.objectContaining({
            order: expect.any(Object),
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
    it("should return invoices for a specific order", async () => {
      prisma.invoice.findMany.mockResolvedValue([fakeInvoice()]);

      await service.findByOrderId("order-1");

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: "order-1" },
        }),
      );
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
    it("should delete an invoice", async () => {
      prisma.invoice.delete.mockResolvedValue(fakeInvoice());

      await service.delete("invoice-1");

      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: "invoice-1" },
      });
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
