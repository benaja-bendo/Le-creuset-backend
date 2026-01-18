import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Get all invoices (admin only)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findAll() {
    return this.invoicesService.findAll();
  }

  /**
   * Get current user's invoices (client)
   */
  @Get('me')
  async findMine(@Req() req: AuthRequest) {
    return this.invoicesService.findByUserId(req.user.id);
  }

  /**
   * Get invoices for a specific user (admin/internal)
   */
  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async findByUser(@Param('userId') userId: string) {
    return this.invoicesService.findByUserId(userId);
  }

  /**
   * Get invoices for a specific order
   */
  @Get('order/:orderId')
  async findByOrder(@Param('orderId') orderId: string) {
    return this.invoicesService.findByOrderId(orderId);
  }

  /**
   * Get invoice by ID
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.invoicesService.findById(id);
  }

  /**
   * Create a new invoice (admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  /**
   * Delete an invoice (admin only)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    await this.invoicesService.delete(id);
    return { success: true };
  }
}
