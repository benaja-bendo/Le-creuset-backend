import { Test, TestingModule } from "@nestjs/testing";
import { MoldsController } from "./molds.controller";
import { MoldsService } from "./molds.service";
import { fakeMold } from "../common/test-utils";

describe("MoldsController", () => {
  let controller: MoldsController;
  let moldsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    moldsService = {
      findByUser: jest.fn().mockResolvedValue([fakeMold()]),
      findAll: jest.fn().mockResolvedValue([fakeMold()]),
      create: jest.fn().mockResolvedValue(fakeMold()),
      delete: jest.fn().mockResolvedValue(fakeMold()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MoldsController],
      providers: [{ provide: MoldsService, useValue: moldsService }],
    }).compile();

    controller = module.get<MoldsController>(MoldsController);
  });

  describe("GET /me", () => {
    it("should return molds for current user", async () => {
      const req = { user: { id: "user-1" } };
      await controller.getMyMolds(req);
      expect(moldsService.findByUser).toHaveBeenCalledWith("user-1");
    });
  });

  describe("GET /all", () => {
    it("should return all molds (admin)", async () => {
      await controller.getAllMolds();
      expect(moldsService.findAll).toHaveBeenCalled();
    });
  });

  describe("POST /", () => {
    it("should create a mold", async () => {
      const dto = {
        userId: "user-1",
        reference: "REF-001",
        name: "Bague",
      };
      await controller.create(dto);
      expect(moldsService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe("DELETE /:id", () => {
    it("should delete a mold", async () => {
      await controller.delete("mold-1");
      expect(moldsService.delete).toHaveBeenCalledWith("mold-1");
    });
  });
});
