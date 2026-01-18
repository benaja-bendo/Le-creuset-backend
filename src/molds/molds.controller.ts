import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('molds')
@UseGuards(JwtAuthGuard)
export class MoldsController {
  constructor(private readonly moldsService: MoldsService) {}

  @Get('me')
  async getMyMolds(@Req() req: any) {
    return this.moldsService.findByUser(req.user.id);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAllMolds() {
    return this.moldsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: { userId: string; reference: string; name: string; photoUrl?: string }) {
    return this.moldsService.create(dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async delete(@Param('id') id: string) {
    return this.moldsService.delete(id);
  }
}
