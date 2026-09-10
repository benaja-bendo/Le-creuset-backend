import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { MoldsService } from "./molds.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { PaginationQueryDto } from "../common/pagination.dto";

@Controller("molds")
@UseGuards(JwtAuthGuard)
export class MoldsController {
  constructor(private readonly moldsService: MoldsService) {}

  @Get("me")
  async getMyMolds(@Req() req: any) {
    return this.moldsService.findByUser(req.user.id);
  }

  @Get("all")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async getAllMolds(@Query() query: PaginationQueryDto) {
    return this.moldsService.findAll(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async create(
    @Body()
    dto: {
      userId: string;
      reference: string;
      name: string;
      photoUrl?: string;
      notes?: string;
    },
  ) {
    return this.moldsService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body()
    dto: {
      reference?: string;
      name?: string;
      photoUrl?: string;
      notes?: string;
    },
  ) {
    return this.moldsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    return this.moldsService.delete(id);
  }
}
