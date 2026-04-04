import { Test, TestingModule } from "@nestjs/testing";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { fakeInvoice } from "../common/test-utils";

describe("InvoicesController", () => {
  let controller: InvoicesController;
  let invoicesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    invoicesService = {
      findAll: jest.fn().mockResolvedValue([fakeInvoice()]),
      findByUserId: jest.fn().mockResolvedValue([fakeInvoice()]),
      findById: jest.fn().mockResolvedValue(fakeInvoice()),
      findByOrderId: jest.fn().mockResolvedValue([fakeInvoice()]),
      create: jest.fn().mockResolvedValue(fakeInvoice()),
      delete: jest.fn().mockResolvedValue(fakeInvoice()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: invoicesService }],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
  });

  const mockReq = () => ({
    user: { id: "user-1", email: "test@example.com", role: "ADMIN" },
  });

  describe("GET /", () => {
    it("should return all invoices (admin)", async () => {
      const result = await controller.findAll();
      expect(invoicesService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe("GET /me", () => {
    it("should return current user invoices", async () => {
      const req = mockReq();
      await controller.findMine(req as any);
      expect(invoicesService.findByUserId).toHaveBeenCalledWith("user-1");
    });
  });

  describe("GET /user/:userId", () => {
    it("should return invoices for specified user", async () => {
      await controller.findByUser("user-2");
      expect(invoicesService.findByUserId).toHaveBeenCalledWith("user-2");
    });
  });

  describe("GET /order/:orderId", () => {
    it("should return invoices for an order", async () => {
      await controller.findByOrder("order-1");
      expect(invoicesService.findByOrderId).toHaveBeenCalledWith("order-1");
    });
  });

  describe("GET /:id", () => {
    it("should return an invoice by id", async () => {
      await controller.findById("invoice-1");
      expect(invoicesService.findById).toHaveBeenCalledWith("invoice-1");
    });
  });

  describe("POST /", () => {
    it("should create an invoice", async () => {
      const dto = {
        invoiceNumber: "INV-001",
        orderId: "order-1",
        userId: "user-1",
        fileUrl: "/file.pdf",
      };
      await controller.create(dto as any);
      expect(invoicesService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe("DELETE /:id", () => {
    it("should delete an invoice and return success", async () => {
      const result = await controller.delete("invoice-1");
      expect(invoicesService.delete).toHaveBeenCalledWith("invoice-1");
      expect(result).toEqual({ success: true });
    });
  });
});
