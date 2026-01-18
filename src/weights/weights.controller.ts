import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { WeightsService } from './weights.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TransactionType } from '@prisma/client';

@Controller('weights')
@UseGuards(JwtAuthGuard)
export class WeightsController {
  constructor(private readonly weightsService: WeightsService) {}

  /**
   * Return metal accounts for the logged-in user
   */
  @Get('me')
  async getMyWeights(@Req() req: any) {
    return this.weightsService.getUserAccounts(req.user.id);
  }

  /**
   * Admin: view all metal accounts
   */
  @Get('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAllWeights() {
    return this.weightsService.getAllAccounts();
  }
  
  /**
   * Admin: view metal accounts for a specific user
   */
  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getUserWeights(@Param('userId') userId: string) {
    return this.weightsService.getUserAccounts(userId);
  }

  /**
   * Admin: add a transaction to an account
   */
  @Post(':id/transaction')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async addTransaction(
    @Param('id') id: string,
    @Body() dto: { type: TransactionType; amount: number; label: string; date?: string }
  ) {
    return this.weightsService.addTransaction(id, {
      ...dto,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }
}
