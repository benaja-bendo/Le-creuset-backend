import { Test, TestingModule } from "@nestjs/testing";
import { InvoiceGroupsController } from "./invoice-groups.controller";
import { InvoiceGroupsService } from "./invoice-groups.service";

describe("InvoiceGroupsController", () => {
  let controller: InvoiceGroupsController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: "group-1", orders: [] }),
      findAll: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      findOne: jest.fn().mockResolvedValue({ id: "group-1" }),
      update: jest.fn().mockResolvedValue({ id: "group-1", notes: "updated" }),
      remove: jest.fn().mockResolvedValue({ id: "group-1" }),
      suggestNextInvoiceGroupNumber: jest
        .fn()
        .mockResolvedValue("FAC-GRP-2026-0001"),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceGroupsController],
      providers: [{ provide: InvoiceGroupsService, useValue: service }],
    }).compile();

    controller = module.get<InvoiceGroupsController>(InvoiceGroupsController);
  });

  describe("POST /", () => {
    it("should create an invoice group", async () => {
      const dto = {
        orderIds: ["o-1"],
        invoiceNumber: "GRP-001",
        userId: "u-1",
      };
      await controller.create(dto as any);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe("GET /", () => {
    it("should return a paginated page of groups", async () => {
      await controller.findAll({} as any);
      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe("GET /:id", () => {
    it("should return a group by id", async () => {
      await controller.findOne("group-1");
      expect(service.findOne).toHaveBeenCalledWith("group-1");
    });
  });

  describe("GET /next-number", () => {
    it("should return the suggested invoice number", async () => {
      const result = await controller.getNextInvoiceNumber();
      expect(service.suggestNextInvoiceGroupNumber).toHaveBeenCalled();
      expect(result).toEqual({ invoiceNumber: "FAC-GRP-2026-0001" });
    });
  });

  describe("PATCH /:id", () => {
    it("should update a group", async () => {
      const dto = { notes: "updated" };
      await controller.update("group-1", dto as any);
      expect(service.update).toHaveBeenCalledWith("group-1", dto);
    });
  });

  describe("DELETE /:id", () => {
    it("should remove a group", async () => {
      await controller.remove("group-1");
      expect(service.remove).toHaveBeenCalledWith("group-1");
    });
  });
});
