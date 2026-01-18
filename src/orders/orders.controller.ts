import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrderStatus } from '@prisma/client';
import { CloseOrderDto } from './dto/close-order.dto';
import { MailService } from '../mail/mail.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly mailService: MailService,
  ) {}

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

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async updateStatus(@Param('id') id: string, @Body() dto: { status: OrderStatus }) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  /**
   * Close an order: import invoice, update status, optionally debit weight account, send email
   */
  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async closeOrder(@Param('id') id: string, @Body() dto: CloseOrderDto) {
    const result = await this.ordersService.closeOrder(id, {
      invoiceNumber: dto.invoiceNumber,
      invoiceFileUrl: dto.invoiceFileUrl,
      finalAmount: dto.finalAmount,
      finalWeight: dto.finalWeight,
      debitWeightAccount: dto.debitWeightAccount,
      metalType: dto.metalType,
    });

    // Send notification email to client
    if (result.order.user?.email) {
      await this.mailService.sendOrderCompletedEmail(
        result.order.user.email,
        id.slice(-6),
        result.invoice.invoiceNumber,
        dto.finalAmount,
      );
    }

    return {
      success: true,
      order: result.order,
      invoice: result.invoice,
      message: 'Commande clôturée avec succès. Email envoyé au client.',
    };
  }
}

