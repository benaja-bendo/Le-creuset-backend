import { Injectable, Inject, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { IStorageDriver, UploadResult, FileStats, STORAGE_DRIVER } from './storage.interface';

/**
 * Service de stockage principal.
 * Délègue les opérations au driver configuré (local ou MinIO).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_DRIVER)
    private readonly driver: IStorageDriver,
  ) {}

  /**
   * Upload a file using the configured storage driver
   */
  async uploadFile(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    mimeType: string,
  ): Promise<UploadResult> {
    return this.driver.uploadFile(objectName, data, size, mimeType);
  }

  /**
   * Download a file from storage
   */
  async downloadFile(objectName: string): Promise<Readable> {
    return this.driver.downloadFile(objectName);
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(objectName: string): Promise<void> {
    return this.driver.deleteFile(objectName);
  }

  /**
   * Check if a file exists
   */
  async fileExists(objectName: string): Promise<boolean> {
    return this.driver.fileExists(objectName);
  }

  /**
   * Get file metadata
   */
  async getFileStats(objectName: string): Promise<FileStats> {
    return this.driver.getFileStats(objectName);
  }

  /**
   * Get a presigned URL (only available with MinIO driver)
   */
  async getPresignedUrl(objectName: string, expirySeconds = 3600): Promise<string | null> {
    if (this.driver.getPresignedUrl) {
      return this.driver.getPresignedUrl(objectName, expirySeconds);
    }
    return null;
  }
}
