import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { IStorageDriver, UploadResult, FileStats } from './storage.interface';
import { lookup } from 'mime-types';

/**
 * Driver de stockage local sur le système de fichiers.
 * Les fichiers sont stockés dans le dossier configuré via STORAGE_LOCAL_PATH.
 */
@Injectable()
export class LocalStorageService implements IStorageDriver, OnModuleInit {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = this.configService.get<string>('STORAGE_LOCAL_PATH', './uploads');
  }

  async onModuleInit() {
    await this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
      this.logger.log(`✅ Created local storage directory: ${this.basePath}`);
    } else {
      this.logger.log(`✅ Local storage directory exists: ${this.basePath}`);
    }
  }

  private getFullPath(objectName: string): string {
    return join(this.basePath, objectName);
  }

  async uploadFile(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    mimeType: string,
  ): Promise<UploadResult> {
    const fullPath = this.getFullPath(objectName);
    
    // Ensure parent directory exists
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(fullPath);
      let hash = createHash('md5');

      writeStream.on('finish', () => {
        this.logger.log(`📤 Uploaded file locally: ${objectName}`);
        resolve({
          storagePath: objectName,
          etag: hash.digest('hex'),
          size,
        });
      });

      writeStream.on('error', reject);

      if (Buffer.isBuffer(data)) {
        hash.update(data);
        writeStream.write(data);
        writeStream.end();
      } else {
        data.on('data', (chunk) => hash.update(chunk));
        data.pipe(writeStream);
      }
    });
  }

  async downloadFile(objectName: string): Promise<Readable> {
    const fullPath = this.getFullPath(objectName);
    
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${objectName}`);
    }

    return createReadStream(fullPath);
  }

  async deleteFile(objectName: string): Promise<void> {
    const fullPath = this.getFullPath(objectName);
    
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      this.logger.log(`🗑️ Deleted file locally: ${objectName}`);
    }
  }

  async fileExists(objectName: string): Promise<boolean> {
    return existsSync(this.getFullPath(objectName));
  }

  async getFileStats(objectName: string): Promise<FileStats> {
    const fullPath = this.getFullPath(objectName);
    
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${objectName}`);
    }

    const stats = statSync(fullPath);
    const mimeType = lookup(objectName) || 'application/octet-stream';

    return {
      size: stats.size,
      mimeType,
      lastModified: stats.mtime,
    };
  }
}
