import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { MailService } from "../mail/mail.service";
import {
  createMockMailService,
  fakeOrder,
  fakeInvoice,
  fakeUser,
} from "../common/test-utils";

describe("OrdersController", () => {
  let controller: OrdersController;
  let ordersService: Record<string, jest.Mock>;
  let mailService: ReturnType<typeof createMockMailService>;

  const mockReq = () => ({
    user: { id: "user-1", email: "test@example.com", role: "CLIENT" },
  });

  beforeEach(async () => {
    ordersService = {
      findByUser: jest.fn().mockResolvedValue([fakeOrder()]),
      findAll: jest
        .fn()
        .mockResolvedValue({ items: [fakeOrder()], total: 1, page: 1, limit: 20 }),
      create: jest.fn().mockResolvedValue(fakeOrder()),
      createManual: jest
        .fn()
        .mockResolvedValue(fakeOrder({ isManualOrder: true })),
      findById: jest.fn().mockResolvedValue(fakeOrder()),
      updateStatus: jest
        .fn()
        .mockResolvedValue(fakeOrder({ status: "TIRAGE_OK" })),
      update: jest.fn().mockResolvedValue(fakeOrder()),
      delete: jest.fn().mockResolvedValue(fakeOrder()),
      closeOrder: jest.fn().mockResolvedValue({
        order: { ...fakeOrder({ status: "EXPEDIE" }), user: fakeUser() },
        invoice: fakeInvoice(),
      }),
    };
    mailService = createMockMailService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  describe("GET /me", () => {
    it("should return orders for current user", async () => {
      const req = mockReq();
      await controller.getMyOrders(req);
      expect(ordersService.findByUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("GET /all", () => {
    it("should return all orders", async () => {
      await controller.getAllOrders({} as any);
      expect(ordersService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe("GET /:id", () => {
    it("should return the order to its own owner", async () => {
      ordersService.findById.mockResolvedValue(fakeOrder({ userId: "user-1" }));
      const req = mockReq(); // user-1, CLIENT

      const result = await controller.getById("order-1", req);

      expect(result).toEqual(fakeOrder({ userId: "user-1" }));
    });

    it("should let an admin read any order", async () => {
      ordersService.findById.mockResolvedValue(
        fakeOrder({ userId: "someone-else" }),
      );
      const req = { user: { id: "admin-1", role: "ADMIN" } };

      await expect(controller.getById("order-1", req)).resolves.toEqual(
        fakeOrder({ userId: "someone-else" }),
      );
    });

    it("should reject a client who does not own the order", async () => {
      ordersService.findById.mockResolvedValue(
        fakeOrder({ userId: "someone-else" }),
      );
      const req = mockReq(); // user-1, CLIENT

      await expect(controller.getById("order-1", req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException if the order does not exist", async () => {
      ordersService.findById.mockResolvedValue(null);
      const req = mockReq();

      await expect(controller.getById("order-1", req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("POST /", () => {
    it("should create an order for the current user", async () => {
      const req = mockReq();
      const dto = { stlFileUrl: "/file.stl", notes: "test" };
      await controller.create(req, dto);
      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" }),
      );
    });
  });

  describe("POST /manual", () => {
    it("should create a manual order", async () => {
      const dto = { userId: "user-2", materialType: "OR_JAUNE_750" };
      await controller.createManual(dto);
      expect(ordersService.createManual).toHaveBeenCalledWith(dto);
    });
  });

  describe("PATCH /:id/status", () => {
    it("should update order status", async () => {
      await controller.updateStatus("order-1", { status: "TIRAGE_OK" as any });
      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        "order-1",
        "TIRAGE_OK",
      );
    });
  });

  describe("DELETE /:id", () => {
    it("should delete an order and return success", async () => {
      const result = await controller.delete("order-1");
      expect(ordersService.delete).toHaveBeenCalledWith("order-1");
      expect(result).toEqual({ success: true });
    });
  });

  describe("POST /:id/close", () => {
    it("should close order, send email, and return result", async () => {
      const dto = {
        invoiceNumber: "INV-001",
        invoiceFileUrl: "/inv.pdf",
        finalAmount: 500,
      };

      const result = await controller.closeOrder("order-1", dto as any);

      expect(ordersService.closeOrder).toHaveBeenCalledWith(
        "order-1",
        expect.objectContaining({ invoiceNumber: "INV-001" }),
      );
      // La reference envoyee au client doit etre son numero de commande.
      expect(mailService.sendOrderCompletedEmail).toHaveBeenCalledWith(
        expect.any(String),
        "CMD-000001",
        expect.any(String),
        expect.anything(),
      );
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });
});
