import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  createMockPrismaService,
  createMockConfigService,
  fakeUser,
} from "../common/test-utils";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe("validate", () => {
    it("should return user payload when user exists", async () => {
      const user = fakeUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await strategy.validate({ sub: user.id });

      expect(result).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      });
    });

    it("should throw UnauthorizedException when user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate({ sub: "nonexistent" })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
