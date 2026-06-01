import { Module } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { WeightsModule } from "../weights/weights.module";

@Module({
  imports: [PrismaModule, WeightsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
