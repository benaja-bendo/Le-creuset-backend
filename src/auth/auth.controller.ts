import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    await this.mailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@lecreuset.fr',
      subject: `Validation requise - Nouveau compte : ${dto.companyName}`,
      html: `
        <h1>Nouvelle inscription à valider</h1>
        <ul>
          <li><strong>Email:</strong> ${dto.email}</li>
          <li><strong>Entreprise:</strong> ${dto.companyName}</li>
          <li><strong>KBIS:</strong> ${dto.kbisFileUrl}</li>
          <li><strong>Douanes:</strong> ${dto.customsFileUrl}</li>
        </ul>
        <p>Veuillez vous <a href="http://localhost:5173/login">connecter en tant qu'administrateur</a> pour accepter ou rejeter ce compte.</p>
      `,
    });
    return result;
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  async logout() {
    return { ok: true };
  }

  @Post('mail-test')
  async mailTest() {
    const res = await this.mailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@lecreuset.fr',
      subject: 'Test SMTP - Mailhog',
      text: 'Ceci est un email de test envoyé via SMTP (Mailhog).',
      html: '<p>Ceci est un email de <strong>test</strong> envoyé via SMTP (Mailhog).</p>',
    });
    return { ok: res.success, id: res.id };
  }
}
