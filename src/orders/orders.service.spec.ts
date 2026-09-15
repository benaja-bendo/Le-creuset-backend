import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
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
    it("should return a paginated page of orders with user and invoices", async () => {
      prisma.order.findMany.mockResolvedValue([fakeOrder()]);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ user: expect.any(Object) }),
          skip: 0,
          take: 20,
        }),
      );
      expect(result).toEqual({
        items: [fakeOrder()],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it("should filter by status and page when provided", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10, status: "FONDU" as any });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "FONDU" },
          skip: 10,
          take: 10,
        }),
      );
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { status: "FONDU" },
      });
    });
  });

  /* ================================================================ */
  /*  create / createManual                                            */
  /* ================================================================ */

  describe("createManual", () => {
    it("should create a manual order with isManualOrder=true", async () => {
      prisma.order.create.mockResolvedValue(fakeOrder({ isManualOrder: true }));

      await service.createManual({
        userId: "user-1",
        materialType: "OR_750_JAUNE",
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

    it("should pass the requested quantity through to Prisma", async () => {
      prisma.order.create.mockResolvedValue(fakeOrder({ quantity: 5 }));

      await service.createManual({
        userId: "user-1",
        materialType: "OR_750_JAUNE",
        quantity: 5,
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantity: 5 }),
        }),
      );
    });

    it("should reject a zero or negative quantity", async () => {
      await expect(
        service.createManual({
          userId: "user-1",
          materialType: "OR_750_JAUNE",
          quantity: 0,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it("should reject a non-integer quantity", async () => {
      await expect(
        service.createManual({
          userId: "user-1",
          materialType: "OR_750_JAUNE",
          quantity: 1.5,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it("should generate a sequential order number when none is provided", async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.create.mockResolvedValue(fakeOrder());

      await service.createManual({ userId: "user-1" });

      const year = new Date().getFullYear();
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: `CMD-${year}-0001`,
          }),
        }),
      );
    });

    it("should use the provided order number instead of generating one", async () => {
      prisma.order.create.mockResolvedValue(fakeOrder());

      await service.createManual({
        userId: "user-1",
        orderNumber: "CMD-CUSTOM",
      });

      expect(prisma.order.findFirst).not.toHaveBeenCalled();
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderNumber: "CMD-CUSTOM" }),
        }),
      );
    });

    it("should turn a duplicate order number into a clear error", async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.0.0",
          meta: { target: ["orderNumber"] },
        },
      );
      prisma.order.create.mockRejectedValue(conflict);

      await expect(
        service.createManual({ userId: "user-1", orderNumber: "CMD-DUP" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("suggestNextOrderNumber", () => {
    it("should suggest 0001 for the year when no order exists yet", async () => {
      prisma.order.findFirst.mockResolvedValue(null);

      const result = await service.suggestNextOrderNumber();

      const year = new Date().getFullYear();
      expect(result).toBe(`CMD-${year}-0001`);
      expect(prisma.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderNumber: { startsWith: `CMD-${year}-` } },
          orderBy: { orderNumber: "desc" },
        }),
      );
    });

    it("should increment the latest order number for the year", async () => {
      const year = new Date().getFullYear();
      prisma.order.findFirst.mockResolvedValue({
        orderNumber: `CMD-${year}-0041`,
      });

      const result = await service.suggestNextOrderNumber();

      expect(result).toBe(`CMD-${year}-0042`);
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

    it("should reject EXPEDIE — only closeOrder may set it", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());

      await expect(
        service.updateStatus("order-1", "EXPEDIE" as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  /* ================================================================ */
  /*  findById / update / delete                                       */
  /* ================================================================ */

  describe("findById", () => {
    it("should select only safe user fields, never passwordHash", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      await service.findById("order-1");

      const call = prisma.order.findUnique.mock.calls[0][0];
      expect(call.where).toEqual({ id: "order-1" });
      expect(call.include.user).toEqual({
        select: {
          id: true,
          email: true,
          companyName: true,
          phone: true,
        },
      });
      expect(call.include.user.select.passwordHash).toBeUndefined();
      expect(call.include.invoices).toBe(true);
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

    it("should update the quantity", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());
      prisma.order.update.mockResolvedValue(fakeOrder({ quantity: 3 }));

      const result = await service.update("order-1", { quantity: 3 });
      expect(result.quantity).toBe(3);
    });

    it("should reject a zero or negative quantity", async () => {
      prisma.order.findUnique.mockResolvedValue(fakeOrder());

      await expect(service.update("order-1", { quantity: -1 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete an order with no linked invoice", async () => {
      prisma.order.findUnique.mockResolvedValue(
        fakeOrder({ invoiceGroupId: null }),
      );
      prisma.invoice.count.mockResolvedValue(0);
      prisma.order.delete.mockResolvedValue(fakeOrder());

      await service.delete("order-1");

      expect(prisma.order.delete).toHaveBeenCalledWith({
        where: { id: "order-1" },
      });
    });

    it("should reject deleting an order with an individual invoice", async () => {
      prisma.order.findUnique.mockResolvedValue(
        fakeOrder({ invoiceGroupId: null }),
      );
      prisma.invoice.count.mockResolvedValue(1);

      await expect(service.delete("order-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.delete).not.toHaveBeenCalled();
    });

    it("should reject deleting an order that belongs to an invoice group", async () => {
      prisma.order.findUnique.mockResolvedValue(
        fakeOrder({ invoiceGroupId: "group-1" }),
      );
      prisma.invoice.count.mockResolvedValue(0);

      await expect(service.delete("order-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.delete).not.toHaveBeenCalled();
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

    it("labels the metal transaction explicitly when the order has no number", async () => {
      // Commandes antérieures à la migration add_order_number : orderNumber est
      // NULL. On annonce l'absence de numéro plutôt que de présenter un
      // fragment d'identifiant technique comme s'il en était un.
      const order = fakeOrder({
        orderNumber: null,
        user: fakeUser(),
        materialType: "OR_750_JAUNE",
      });
      const account = fakeMetalAccount({ metalType: "OR_FIN", balance: 100 });

      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(fakeInvoice());
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      txMock.metalAccount.findFirst.mockResolvedValue(account);
      txMock.transaction.create.mockResolvedValue({});
      txMock.metalAccount.update.mockResolvedValue({ ...account, balance: 90 });
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await service.closeOrder("order-1", {
        invoiceNumber: "INV-003",
        invoiceFileUrl: "/inv.pdf",
        finalWeight: 10,
        debitWeightAccount: true,
        metalType: "OR_750_JAUNE",
      });

      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: "Commande Sans n° (RDER-1) - INV-003",
          }),
        }),
      );
    });

    it("should debit metal account when requested", async () => {
      const order = fakeOrder({
        user: fakeUser(),
        materialType: "OR_750_JAUNE",
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
        metalType: "OR_750_JAUNE",
      });

      expect(txMock.metalAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: order.userId, metalType: "OR_FIN" },
        }),
      );
      // Le libellé est persisté en base et lu par le client dans son historique
      // de compte poids : il doit porter le numéro de commande, pas l'id.
      expect(txMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: "Commande CMD-000001 - INV-002",
          }),
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
      // decrement atomique : ne doit plus jamais envoyer une valeur déjà
      // calculée depuis le solde lu plus haut (perdrait un mouvement
      // concurrent sur le même compte).
      expect(txMock.metalAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { decrement: 10 } }),
        }),
      );
    });

    it("should reject debiting with no finalWeight instead of silently skipping it", async () => {
      const order = fakeOrder({ user: fakeUser() });
      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(fakeInvoice());
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.closeOrder("order-1", {
          invoiceNumber: "INV-005",
          invoiceFileUrl: "/inv.pdf",
          debitWeightAccount: true,
          metalType: "OR_750_JAUNE",
          // finalWeight omis
        }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.metalAccount.update).not.toHaveBeenCalled();
    });

    it("should reject an unrecognized metal type instead of silently skipping the debit", async () => {
      const order = fakeOrder({ user: fakeUser() });
      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(fakeInvoice());
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.closeOrder("order-1", {
          invoiceNumber: "INV-006",
          invoiceFileUrl: "/inv.pdf",
          finalWeight: 10,
          debitWeightAccount: true,
          metalType: "BITCOIN",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.metalAccount.findFirst).not.toHaveBeenCalled();
    });

    it("should reject debiting a metal account the client doesn't have instead of silently skipping it", async () => {
      const order = fakeOrder({ user: fakeUser() });
      const txMock = createMockPrismaService();
      txMock.order.findUnique.mockResolvedValue(order);
      txMock.invoice.create.mockResolvedValue(fakeInvoice());
      txMock.order.update.mockResolvedValue({ ...order, status: "EXPEDIE" });
      txMock.metalAccount.findFirst.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.closeOrder("order-1", {
          invoiceNumber: "INV-007",
          invoiceFileUrl: "/inv.pdf",
          finalWeight: 10,
          debitWeightAccount: true,
          metalType: "OR_750_JAUNE",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(txMock.transaction.create).not.toHaveBeenCalled();
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

    it("should reject closing an order that is already EXPEDIE", async () => {
      const order = fakeOrder({ status: "EXPEDIE", user: fakeUser() });
      prisma.order.findUnique.mockResolvedValue(order);

      await expect(
        service.closeOrder("order-1", {
          invoiceNumber: "INV-004",
          invoiceFileUrl: "/inv.pdf",
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
