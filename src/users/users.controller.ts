import { Body, Controller, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateDocumentsDto } from './dto/update-documents.dto';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface AuthRequest extends Request {
  user: JwtPayload;
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    const user = await this.usersService.register(dto);
    await this.mailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@lecreuset.fr',
      subject: `Nouveau compte en attente : ${dto.companyName ?? dto.email}`,
      html: `
        <h1>Nouvelle inscription à valider</h1>
        <ul>
          <li><strong>Email:</strong> ${dto.email}</li>
          <li><strong>Entreprise:</strong> ${dto.companyName ?? '-'}</li>
          <li><strong>KBIS:</strong> ${dto.kbisFileUrl ?? '-'}</li>
          <li><strong>Douanes:</strong> ${dto.customsFileUrl ?? '-'}</li>
        </ul>
      `,
    });
    return { id: user.id, status: user.status };
  }

  // ============================================
  // Profile Endpoints (Current User)
  // ============================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req: AuthRequest) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  async changeMyPassword(@Req() req: AuthRequest, @Body() dto: UpdatePasswordDto) {
    return this.usersService.changePassword(req.user.id, dto);
  }

  @Patch('me/documents')
  @UseGuards(JwtAuthGuard)
  async updateMyDocuments(@Req() req: AuthRequest, @Body() dto: UpdateDocumentsDto) {
    return this.usersService.updateDocuments(req.user.id, dto);
  }

  // ============================================
  // Admin Endpoints
  // ============================================

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async all() {
    return this.usersService.findAll();
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async pending() {
    return this.usersService.findPending();
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    const result = await this.usersService.updateStatus(id, dto.status);
    if (dto.status === 'ACTIVE') {
      const u = await this.usersService.findById(id);
      if (u?.email) await this.mailService.sendWelcomeEmail(u.email);
      return { id, status: 'ACTIVE' };
    }
    if (dto.status === 'REJECTED') {
      return { id, status: 'REJECTED', deleted: true };
    }
    return { id, status: 'PENDING' };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async byId(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
