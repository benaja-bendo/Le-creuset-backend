import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';
import { STORAGE_DRIVER } from './storage.interface';

/**
 * Module de stockage avec sélection dynamique du driver.
 * Le driver est choisi via la variable d'environnement STORAGE_DRIVER (local | minio).
 */
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [
    StorageService,
    LocalStorageService,
    MinioStorageService,
    {
      provide: STORAGE_DRIVER,
      useFactory: (configService: ConfigService, localDriver: LocalStorageService, minioDriver: MinioStorageService) => {
        const driver = configService.get<string>('STORAGE_DRIVER', 'minio');
        
        if (driver === 'local') {
          console.log('📁 Using LOCAL storage driver');
          return localDriver;
        }
        
        console.log('☁️ Using MINIO storage driver');
        return minioDriver;
      },
      inject: [ConfigService, LocalStorageService, MinioStorageService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
