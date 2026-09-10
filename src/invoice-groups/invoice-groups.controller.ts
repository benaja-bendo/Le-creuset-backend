import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InvoiceGroupsService } from "./invoice-groups.service";
import { CreateInvoiceGroupDto } from "./dto/create-invoice-group.dto";
import { UpdateInvoiceGroupDto } from "./dto/update-invoice-group.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PaginationQueryDto } from "../common/pagination.dto";

@Controller("invoice-groups")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceGroupsController {
  constructor(private readonly invoiceGroupsService: InvoiceGroupsService) {}

  @Post()
  @Roles("ADMIN")
  create(@Body() createInvoiceGroupDto: CreateInvoiceGroupDto) {
    return this.invoiceGroupsService.create(createInvoiceGroupDto);
  }

  @Get()
  @Roles("ADMIN")
  findAll(@Query() query: PaginationQueryDto) {
    return this.invoiceGroupsService.findAll(query);
  }

  /**
   * Suggestion de numéro pour pré-remplir le formulaire de facture groupée.
   * Doit être déclarée avant `:id` pour ne pas être interprétée comme un id.
   */
  @Get("next-number")
  @Roles("ADMIN")
  async getNextInvoiceNumber() {
    return {
      invoiceNumber:
        await this.invoiceGroupsService.suggestNextInvoiceGroupNumber(),
    };
  }

  @Get(":id")
  @Roles("ADMIN")
  findOne(@Param("id") id: string) {
    return this.invoiceGroupsService.findOne(id);
  }

  @Patch(":id")
  @Roles("ADMIN")
  update(
    @Param("id") id: string,
    @Body() updateInvoiceGroupDto: UpdateInvoiceGroupDto,
  ) {
    return this.invoiceGroupsService.update(id, updateInvoiceGroupDto);
  }

  @Delete(":id")
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.invoiceGroupsService.remove(id);
  }
}
