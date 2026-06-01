import { Test, TestingModule } from "@nestjs/testing";
import { WeightsController } from "./weights.controller";
import { WeightsService } from "./weights.service";
import {
  createMockWeightsService,
  fakeMetalAccount,
} from "../common/test-utils";

describe("WeightsController", () => {
  let controller: WeightsController;
  let weightsService: ReturnType<typeof createMockWeightsService>;

  beforeEach(async () => {
    weightsService = createMockWeightsService();
    weightsService.getUserAccounts.mockResolvedValue([fakeMetalAccount()]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeightsController],
      providers: [{ provide: WeightsService, useValue: weightsService }],
    }).compile();

    controller = module.get<WeightsController>(WeightsController);
  });

  describe("GET /me", () => {
    it("should return logged-in user accounts", async () => {
      const req = { user: { id: "user-1" } };
      const result = await controller.getMyWeights(req);
      expect(weightsService.getUserAccounts).toHaveBeenCalledWith("user-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("GET /all", () => {
    it("should return all accounts for admin", async () => {
      await controller.getAllWeights();
      expect(weightsService.getAllAccounts).toHaveBeenCalled();
    });
  });

  describe("GET /user/:userId", () => {
    it("should return accounts for specified user", async () => {
      await controller.getUserWeights("user-2");
      expect(weightsService.getUserAccounts).toHaveBeenCalledWith("user-2");
    });
  });

  describe("POST /:id/transaction", () => {
    it("should add a transaction", async () => {
      const dto = { type: "CREDIT" as any, amount: 50, label: "test" };
      await controller.addTransaction("account-1", dto);
      expect(weightsService.addTransaction).toHaveBeenCalledWith(
        "account-1",
        expect.objectContaining({ type: "CREDIT", amount: 50 }),
      );
    });

    it("should parse date string if provided", async () => {
      const dto = {
        type: "DEBIT" as any,
        amount: 10,
        label: "with date",
        date: "2025-06-01",
      };
      await controller.addTransaction("account-1", dto);
      expect(weightsService.addTransaction).toHaveBeenCalledWith(
        "account-1",
        expect.objectContaining({
          date: expect.any(Date),
        }),
      );
    });
  });
});
