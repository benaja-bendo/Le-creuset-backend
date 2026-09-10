import { Test, TestingModule } from "@nestjs/testing";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { fakeInvoice } from "../common/test-utils";

describe("InvoicesController", () => {
  let controller: InvoicesController;
  let invoicesService: Record<string, jest.Mock>;

  beforeEach(async () => {
    invoicesService = {
      findAll: jest
        .fn()
        .mockResolvedValue({ items: [fakeInvoice()], total: 1, page: 1, limit: 20 }),
      findAllCombined: jest
        .fn()
        .mockResolvedValue({ items: [fakeInvoice()], total: 1, page: 1, limit: 20 }),
      findByUserId: jest.fn().mockResolvedValue([fakeInvoice()]),
      findById: jest.fn().mockResolvedValue(fakeInvoice()),
      findByOrderId: jest.fn().mockResolvedValue([fakeInvoice()]),
      create: jest.fn().mockResolvedValue(fakeInvoice()),
      delete: jest.fn().mockResolvedValue(fakeInvoice()),
      suggestNextInvoiceNumber: jest.fn().mockResolvedValue("FAC-2026-0001"),
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
    it("should return a paginated page of invoices (admin)", async () => {
      const result = await controller.findAll({} as any);
      expect(invoicesService.findAll).toHaveBeenCalledWith({});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("GET /combined", () => {
    it("should return the combined individual+group view (admin)", async () => {
      const result = await controller.findAllCombined({} as any);
      expect(invoicesService.findAllCombined).toHaveBeenCalledWith({});
      expect(result.items).toHaveLength(1);
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
    it("should forward the requesting user for the ownership check", async () => {
      const req = mockReq();
      await controller.findByOrder("order-1", req as any);
      expect(invoicesService.findByOrderId).toHaveBeenCalledWith(
        "order-1",
        req.user,
      );
    });
  });

  describe("GET /:id", () => {
    it("should return an invoice by id", async () => {
      await controller.findById("invoice-1");
      expect(invoicesService.findById).toHaveBeenCalledWith("invoice-1");
    });
  });

  describe("GET /next-number", () => {
    it("should return the suggested invoice number", async () => {
      const result = await controller.getNextInvoiceNumber();
      expect(invoicesService.suggestNextInvoiceNumber).toHaveBeenCalled();
      expect(result).toEqual({ invoiceNumber: "FAC-2026-0001" });
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
