import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { Response } from 'express';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Upload a general file (KBIS, Customs, etc.)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Generate a unique name
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    const objectName = `${timestamp}-${cleanName}`;

    const result = await this.storageService.uploadFile(
      objectName,
      file.buffer,
      file.size,
      file.mimetype,
    );

    return {
      url: `/api/storage/file/${objectName}`,
      originalName: file.originalname,
      storagePath: objectName,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Proxy the file download from MinIO
   * In a real production environment, you might use presigned URLs or a CDN proxy
   */
  @Get('file/:path')
  async getFile(@Param('path') path: string, @Res() res: Response) {
    try {
      const stream = await this.storageService.downloadFile(path);
      const stats = await this.storageService.getFileStats(path);
      
      res.set({
        'Content-Type': stats.mimeType,
        'Content-Length': stats.size,
      });
      
      stream.pipe(res);
    } catch (error) {
      throw new BadRequestException('Fichier introuvable');
    }
  }
}
