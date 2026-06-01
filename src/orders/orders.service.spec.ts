import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  createMockPrismaService,
  fakeOrder,
  fakeUser,
  fakeInvoice,
  fakeMetalAccount,
} from "../common/test-utils";

describe("OrdersService", () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  /* ================================================================ */
  /*  findByUser / findAll                                             */
  /* ================================================================ */

  describe("findByUser", () => {
    it("should return orders for a specific user", async () => {
      const orders = [fakeOrder()];
      prisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findByUser("user-1");

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
        }),
      );
      expect(result).toEqual(orders);
    });
  });

  describe("findAll", () => {
    it("should return all orders with user and invoices", async () => {
      prisma.order.findMany.mockResolvedValue([fakeOrder()]);

      const result = await service.findAll();

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ user: expect.any(Object) }),
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  /* ================================================================ */
  /*  create / createManual                                            */
  /* ================================================================ */

  describe("create", () => {
    it("should create an order with EN_ATTENTE status", async () => {
      prisma.order.create.mockResolvedValue(fakeOrder());

      await service.create({
        userId: "user-1",
        stlFileUrl: "/file.stl",
        materialType: "OR_JAUNE_750" as any,
        notes: "test",
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            status: "EN_ATTENTE",
          }),
        }),
      );
    });
  });

  describe("createManual", () => {
    it("should create a manual order with isManualOrder=true", async () => {
      prisma.order.create.mockResolvedValue(fakeOrder({ isManualOrder: true }));

      await service.createManual({
        userId: "user-1",
        materialType: "OR_JAUNE_750",
        notes: "manual",
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isManualOrder: true,
          }),
        }),
      );
    });
  });

  /* ================================================================ */
  /*  updateStatus                                                     */
  /* ================================================================ */

  describe("updateStatus", () => {
    it("should update order status", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      prisma.order.update.mockResolvedValue(fakeOrder({ status: "TIRAGE_OK" }));

      const result = await service.updateStatus("order-1", "TIRAGE_OK" as any);

      expect(result.status).toBe("TIRAGE_OK");
    });

    it("should throw NotFoundException if order not found", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus("nonexistent", "TIRAGE_OK" as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ================================================================ */
  /*  findById / update / delete                                       */
  /* ================================================================ */

  describe("findById", () => {
    it("should return order with relations", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      await service.findById("order-1");
      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "order-1" },
          include: expect.objectContaining({ user: true }),
        }),
      );
    });
  });

  describe("update", () => {
    it("should update order fields", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      prisma.order.update.mockResolvedValue(fakeOrder({ notes: "updated" }));

      const result = await service.update("order-1", { notes: "updated" });
      expect(result.notes).toBe("updated");
    });

    it("should throw NotFoundException if order not found", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { notes: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("delete", () => {
    it("should delete related invoices then the order", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      prisma.invoice.deleteMany.mockResolvedValue({ count: 1 });
      prisma.order.delete.mockResolvedValue(fakeOrder());

      await service.delete("order-1");

      expect(prisma.invoice.deleteMany).toHaveBeenCalledWith({
        where: { orderId: "order-1" },
      });
      expect(prisma.order.delete).toHaveBeenCalledWith({
        where: { id: "order-1" },
      });
    });

    it("should throw NotFoundException if order not found", async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.delete("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ================================================================ */
  /*  closeOrder                                                       */
  /* ================================================================ */

  describe("closeOrder", () => {
    it("should create invoice and update order status to EXPEDIE", async () => {
      const order = fakeOrder({ user: fakeUser() });
      const invoice = fakeInvoice();

      // Setup the transaction mock to use our controlled tx
      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(invoice);
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      // Partially import to make the TX mock work
      prisma.order.findUnique.mockResolvedValue(order);

      const result = await service.closeOrder("order-1", {
        invoiceNumber: "INV-001",
        invoiceFileUrl: "/invoice.pdf",
        finalAmount: 500,
      });

      expect(txMock.invoice.create).toHaveBeenCalled();
      expect(txMock.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "EXPEDIE" }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          order: expect.any(Object),
          invoice: expect.any(Object),
        }),
      );
    });

    it("should debit metal account when requested", async () => {
      const order = fakeOrder({
        user: fakeUser(),
        materialType: "OR_JAUNE_750",
      });
      const account = fakeMetalAccount({ metalType: "OR_FIN", balance: 100 });

      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(fakeInvoice());
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      txMock.metalAccount.findFirst.mockResolvedValue(account);
      txMock.transaction.create.mockResolvedValue({});
      txMock.metalAccount.update.mockResolvedValue({
        ...account,
        balance: 90,
      });
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.closeOrder("order-1", {
        invoiceNumber: "INV-002",
        invoiceFileUrl: "/inv.pdf",
        finalAmount: 500,
        finalWeight: 10,
        debitWeightAccount: true,
        metalType: "OR_JAUNE_750",
      });

      expect(txMock.metalAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: order.userId, metalType: "OR_FIN" },
        }),
      );
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "DEBIT",
            amount: 10,
          }),
        }),
      );
    });

    it("should throw NotFoundException if order not found", async () => {
      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.closeOrder("nonexistent", {
          invoiceNumber: "INV-X",
          invoiceFileUrl: "/x.pdf",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
