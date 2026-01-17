import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

export interface UploadedFile {
  storagePath: string;
  etag: string;
  size: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin123'),
    });

    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'lecreuset-files');
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`✅ Created bucket: ${this.bucket}`);
      } else {
        this.logger.log(`✅ Bucket exists: ${this.bucket}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error}`);
      throw error;
    }
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    mimeType: string,
  ): Promise<UploadedFile> {
    const result = await this.client.putObject(
      this.bucket,
      objectName,
      data,
      size,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`📤 Uploaded file: ${objectName}`);

    return {
      storagePath: objectName,
      etag: result.etag,
      size,
    };
  }

  /**
   * Download a file from MinIO
   */
  async downloadFile(objectName: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectName);
  }

  /**
   * Get a presigned URL for file download (valid for 1 hour by default)
   */
  async getPresignedUrl(objectName: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expirySeconds);
  }

  /**
   * Delete a file from MinIO
   */
  async deleteFile(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
    this.logger.log(`🗑️ Deleted file: ${objectName}`);
  }

  /**
   * Check if a file exists
   */
  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileStats(objectName: string): Promise<Minio.BucketItemStat> {
    return this.client.statObject(this.bucket, objectName);
  }
}
