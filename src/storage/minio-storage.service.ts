import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { IStorageDriver, UploadResult, FileStats } from './storage.interface';

/**
 * Driver de stockage MinIO (compatible S3).
 * Configuration via variables d'environnement MINIO_*.
 */
@Injectable()
export class MinioStorageService implements IStorageDriver, OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
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

  async uploadFile(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    mimeType: string,
  ): Promise<UploadResult> {
    const result = await this.client.putObject(
      this.bucket,
      objectName,
      data,
      size,
      { 'Content-Type': mimeType },
    );

    this.logger.log(`📤 Uploaded file to MinIO: ${objectName}`);

    return {
      storagePath: objectName,
      etag: result.etag,
      size,
    };
  }

  async downloadFile(objectName: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectName);
  }

  async deleteFile(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
    this.logger.log(`🗑️ Deleted file from MinIO: ${objectName}`);
  }

  async fileExists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(objectName: string): Promise<FileStats> {
    const stats = await this.client.statObject(this.bucket, objectName);
    return {
      size: stats.size,
      mimeType: stats.metaData['content-type'] || 'application/octet-stream',
      lastModified: stats.lastModified,
    };
  }

  async getPresignedUrl(objectName: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expirySeconds);
  }
}
