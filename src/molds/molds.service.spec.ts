import { Test, TestingModule } from "@nestjs/testing";
import { MoldsService } from "./molds.service";
import { PrismaService } from "../prisma/prisma.service";
import { createMockPrismaService, fakeMold } from "../common/test-utils";

describe("MoldsService", () => {
  let service: MoldsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MoldsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MoldsService>(MoldsService);
  });

  describe("findByUser", () => {
    it("should return molds for a user sorted by name", async () => {
      prisma.mold.findMany.mockResolvedValue([fakeMold()]);

      const result = await service.findByUser("user-1");

      expect(prisma.mold.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { name: "asc" },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("findAll", () => {
    it("should return all molds with user info", async () => {
      prisma.mold.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.mold.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ user: expect.any(Object) }),
        }),
      );
    });
  });

  describe("create", () => {
    it("should create a mold", async () => {
      const data = {
        userId: "user-1",
        reference: "REF-001",
        name: "Bague",
        photoUrl: "/api/storage/file/photo.jpg",
      };
      prisma.mold.create.mockResolvedValue(fakeMold(data));

      const result = await service.create(data);

      expect(prisma.mold.create).toHaveBeenCalledWith({ data });
      expect(result.reference).toBe("REF-001");
    });
  });

  describe("delete", () => {
    it("should delete a mold", async () => {
      prisma.mold.delete.mockResolvedValue(fakeMold());

      await service.delete("mold-1");

      expect(prisma.mold.delete).toHaveBeenCalledWith({
        where: { id: "mold-1" },
      });
    });
  });
});
