import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('me')
  async getMyOrders(@Req() req: any) {
    return this.ordersService.findByUser(req.user.id);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAllOrders() {
    return this.ordersService.findAll();
  }

  @Post()
  async create(@Req() req: any, @Body() dto: { stlFileUrl?: string; estimatedPrice?: number }) {
    return this.ordersService.create({
      userId: req.user.id,
      ...dto,
    });
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updateStatus(@Param('id') id: string, @Body() dto: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
