import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MoldsController],
  providers: [MoldsService],
  exports: [MoldsService],
})
export class MoldsModule {}
