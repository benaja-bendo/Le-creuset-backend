import { Test, TestingModule } from "@nestjs/testing";
import { StorageService } from "./storage.service";
import { STORAGE_DRIVER } from "./storage.interface";
import { createMockStorageDriver } from "../common/test-utils";
import { Readable } from "stream";

describe("StorageService", () => {
  let service: StorageService;
  let driver: ReturnType<typeof createMockStorageDriver>;

  beforeEach(async () => {
    driver = createMockStorageDriver();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: STORAGE_DRIVER, useValue: driver },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe("uploadFile", () => {
    it("should delegate to driver", async () => {
      const buf = Buffer.from("test");
      await service.uploadFile("test.pdf", buf, 4, "application/pdf");

      expect(driver.uploadFile).toHaveBeenCalledWith(
        "test.pdf",
        buf,
        4,
        "application/pdf",
      );
    });
  });

  describe("downloadFile", () => {
    it("should delegate to driver", async () => {
      await service.downloadFile("test.pdf");
      expect(driver.downloadFile).toHaveBeenCalledWith("test.pdf");
    });
  });

  describe("deleteFile", () => {
    it("should delegate to driver", async () => {
      await service.deleteFile("test.pdf");
      expect(driver.deleteFile).toHaveBeenCalledWith("test.pdf");
    });
  });

  describe("fileExists", () => {
    it("should delegate to driver", async () => {
      const result = await service.fileExists("test.pdf");
      expect(driver.fileExists).toHaveBeenCalledWith("test.pdf");
      expect(result).toBe(true);
    });
  });

  describe("getFileStats", () => {
    it("should delegate to driver", async () => {
      const result = await service.getFileStats("test.pdf");
      expect(driver.getFileStats).toHaveBeenCalledWith("test.pdf");
      expect(result).toEqual({ size: 1024, mimeType: "application/pdf" });
    });
  });

  describe("getPresignedUrl", () => {
    it("should return URL when driver supports it", async () => {
      const result = await service.getPresignedUrl("test.pdf", 3600);
      expect(driver.getPresignedUrl).toHaveBeenCalledWith("test.pdf", 3600);
      expect(result).toBe("https://signed-url.example.com");
    });

    it("should return null when driver does not support presigned URLs", async () => {
      driver.getPresignedUrl = undefined as any;
      const result = await service.getPresignedUrl("test.pdf");
      expect(result).toBeNull();
    });
  });
});
