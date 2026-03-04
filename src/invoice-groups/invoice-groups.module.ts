import { Module } from '@nestjs/common';
import { InvoiceGroupsService } from './invoice-groups.service';
import { InvoiceGroupsController } from './invoice-groups.controller';

@Module({
  controllers: [InvoiceGroupsController],
  providers: [InvoiceGroupsService],
})
export class InvoiceGroupsModule {}
