import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { MailService } from '../mail/mail.service';

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

  @Get('pending')
  async pending() {
    return this.usersService.findPending();
  }

  @Patch(':id/status')
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
  async byId(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
