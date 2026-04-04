import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "./prisma/prisma.service";
import { createMockPrismaService } from "./common/test-utils";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe("GET /health", () => {
    it("should return ok status when database is healthy", async () => {
      prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await controller.check();

      expect(result).toEqual(
        expect.objectContaining({
          status: "ok",
          services: { database: "ok" },
        }),
      );
      expect(result.timestamp).toBeDefined();
    });

    it("should return error status when database is unreachable", async () => {
      prisma.$queryRaw.mockRejectedValue(new Error("Connection refused"));

      const result = await controller.check();

      expect(result).toEqual(
        expect.objectContaining({
          status: "ok",
          services: { database: "error" },
        }),
      );
    });
  });
});
