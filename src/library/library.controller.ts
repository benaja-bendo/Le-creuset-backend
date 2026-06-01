import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { LibraryService } from "./library.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("library")
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get("me")
  async getMine(@Req() req: any) {
    return this.libraryService.findByUser(req.user.id);
  }

  @Get("all")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async getAll() {
    return this.libraryService.findAll();
  }

  @Get("user/:userId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async getByUser(@Param("userId") userId: string) {
    return this.libraryService.findByUser(userId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async create(
    @Body()
    dto: {
      userId: string;
      name: string;
      reference?: string;
      fileUrl: string;
      notes?: string;
    },
  ) {
    return this.libraryService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async update(
    @Param("id") id: string,
    @Body() dto: { name?: string; reference?: string; notes?: string },
  ) {
    return this.libraryService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async delete(@Param("id") id: string) {
    await this.libraryService.delete(id);
    return { success: true };
  }
}
