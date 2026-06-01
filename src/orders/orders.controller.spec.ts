import { Test, TestingModule } from "@nestjs/testing";
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
      findAll: jest.fn().mockResolvedValue([fakeOrder()]),
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
      await controller.getAllOrders();
      expect(ordersService.findAll).toHaveBeenCalled();
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
      expect(mailService.sendOrderCompletedEmail).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });
});
