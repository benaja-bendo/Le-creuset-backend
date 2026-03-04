import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { InvoiceGroupsService } from './invoice-groups.service';
import { CreateInvoiceGroupDto } from './dto/create-invoice-group.dto';
import { UpdateInvoiceGroupDto } from './dto/update-invoice-group.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('invoice-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceGroupsController {
  constructor(private readonly invoiceGroupsService: InvoiceGroupsService) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() createInvoiceGroupDto: CreateInvoiceGroupDto) {
    return this.invoiceGroupsService.create(createInvoiceGroupDto);
  }

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.invoiceGroupsService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.invoiceGroupsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() updateInvoiceGroupDto: UpdateInvoiceGroupDto) {
    return this.invoiceGroupsService.update(id, updateInvoiceGroupDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.invoiceGroupsService.remove(id);
  }
}
