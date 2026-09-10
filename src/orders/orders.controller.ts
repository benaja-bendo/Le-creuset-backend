import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { OrderStatus } from "@prisma/client";
import { CloseOrderDto } from "./dto/close-order.dto";
import { MailService } from "../mail/mail.service";
import { orderReference } from "../common/order-ref";
import { PaginationQueryDto } from "../common/pagination.dto";

@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly mailService: MailService,
  ) {}

  @Get("me")
  async getMyOrders(@Req() req: any) {
    return this.ordersService.findByUser(req.user.id);
  }

  @Get("all")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async getAllOrders(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Post()
  async create(
    @Req() req: any,
    @Body()
    dto: {
      stlFileUrl?: string;
      estimatedPrice?: number;
      materialType?: string;
      notes?: string;
    },
  ) {
    return this.ordersService.create({
      userId: req.user.id,
      ...dto,
      materialType: dto.materialType as any,
    });
  }

  @Post("manual")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async createManual(
    @Body()
    dto: {
      userId: string;
      estimatedPrice?: number;
      materialType?: string;
      notes?: string;
      orderNumber?: string;
    },
  ) {
    return this.ordersService.createManual(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async getAll(@Query() query: PaginationQueryDto) {
    return this.ordersService.findAll(query);
  }

  /**
   * Cette route n'a que JwtAuthGuard : n'importe quel client connecté
   * disposant d'un id de commande pouvait lire la fiche complète d'un autre
   * client. Le contrôle de propriété doit donc vivre ici, pas dans un
   * @Roles — un client légitime doit garder accès à SA commande.
   */
  @Get(":id")
  async getById(@Param("id") id: string, @Req() req: any) {
    const order = await this.ordersService.findById(id);
    if (!order) throw new NotFoundException("Commande non trouvée");
    if (order.userId !== req.user.id && req.user.role !== "ADMIN") {
      throw new ForbiddenException("Vous n'avez pas accès à cette commande");
    }
    return order;
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: { status: OrderStatus },
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body() dto: { materialType?: string; notes?: string; stlFileUrl?: string },
  ) {
    return this.ordersService.update(id, dto as any);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    await this.ordersService.delete(id);
    return { success: true };
  }

  /**
   * Close an order: import invoice, update status, optionally debit weight account, send email
   */
  @Post(":id/close")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async closeOrder(@Param("id") id: string, @Body() dto: CloseOrderDto) {
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
        // Référence lisible par le client : son numéro de commande, pas l'id technique.
        orderReference(result.order),
        result.invoice.invoiceNumber,
        dto.finalAmount,
      );
    }

    return {
      success: true,
      order: result.order,
      invoice: result.invoice,
      message: "Commande clôturée avec succès. Email envoyé au client.",
    };
  }
}
