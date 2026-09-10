import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { Request } from "express";
import { PaginationQueryDto } from "../common/pagination.dto";

interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller("invoices")
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * Get all invoices (admin only), paginée
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async findAll(@Query() query: PaginationQueryDto) {
    return this.invoicesService.findAll(query);
  }

  /**
   * Vue combinée factures individuelles + groupées, paginée — consommée par
   * admin/Invoices.tsx, qui affiche les deux dans un seul tableau trié.
   * Doit être déclarée avant `:id` pour ne pas être interprétée comme un id.
   */
  @Get("combined")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async findAllCombined(@Query() query: PaginationQueryDto) {
    return this.invoicesService.findAllCombined(query);
  }

  /**
   * Get current user's invoices (client)
   */
  @Get("me")
  async findMine(@Req() req: AuthRequest) {
    return this.invoicesService.findByUserId(req.user.id);
  }

  /**
   * Get invoices for a specific user (admin/internal)
   */
  @Get("user/:userId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async findByUser(@Param("userId") userId: string) {
    return this.invoicesService.findByUserId(userId);
  }

  /**
   * Get invoices for a specific order (contrôle propriétaire-ou-admin fait
   * dans le service, qui a besoin de lire order.userId pour trancher)
   */
  @Get("order/:orderId")
  async findByOrder(
    @Param("orderId") orderId: string,
    @Req() req: AuthRequest,
  ) {
    return this.invoicesService.findByOrderId(orderId, req.user);
  }

  /**
   * Get invoice by ID — aucun consommateur front actuellement (vérifié :
   * seul un DELETE /invoices/:id existe côté front, route distincte déjà
   * gated ADMIN plus bas). Restreint à ADMIN plutôt que d'ajouter un contrôle
   * propriétaire pour une route que personne n'appelle.
   */
  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async findById(@Param("id") id: string) {
    return this.invoicesService.findById(id);
  }

  /**
   * Create a new invoice (admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async create(@Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(dto);
  }

  /**
   * Delete an invoice (admin only)
   */
  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    await this.invoicesService.delete(id);
    return { success: true };
  }
}
