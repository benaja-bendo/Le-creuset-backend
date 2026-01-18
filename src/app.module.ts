import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './health.controller';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WeightsModule } from './weights/weights.module';
import { MoldsModule } from './molds/molds.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Core modules
    PrismaModule,
    StorageModule,
    MailModule,
    UsersModule,
    AuthModule,
    WeightsModule,
    MoldsModule,
    OrdersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global Zod validation pipe
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
