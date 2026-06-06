import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { MailService } from "../mail/mail.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @Post("forgot-password")
  async forgotPassword(@Body("email") email: string) {
    if (!email) return { ok: true };
    const resetLink = await this.authService.generatePasswordResetLink(email);
    if (resetLink) {
      await this.mailService.sendEmail({
        to: email,
        subject: "Réinitialisation de votre mot de passe - La Grenaille",
        html: `
          <h1>Réinitialisation de mot de passe</h1>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :</p>
          <p><a href="${resetLink}">Réinitialiser mon mot de passe</a></p>
          <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
        `,
      });
    }
    return { ok: true, message: "Si cet email existe, un lien a été envoyé." };
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: any) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true, message: "Mot de passe mis à jour avec succès." };
  }

  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    await this.mailService.sendEmail({
      to: process.env.ADMIN_EMAIL || "admin@lagrenaille.fr",
      subject: `Validation requise - Nouveau compte : ${dto.companyName}`,
      html: `
        <h1>Nouvelle inscription à valider</h1>
        <ul>
          <li><strong>Email:</strong> ${dto.email}</li>
          <li><strong>Entreprise:</strong> ${dto.companyName}</li>
          <li><strong>KBIS:</strong> ${dto.kbisFileUrl}</li>
          <li><strong>Douanes:</strong> ${dto.customsFileUrl}</li>
        </ul>
        <p>Veuillez vous <a href="${this.configService.get<string>(
          "FRONTEND_URL",
          "http://dev.lagrenaille.fr/login",
        )}">connecter en tant qu'administrateur</a> pour accepter ou rejeter ce compte.</p>
      `,
    });
    return result;
  }

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return req.user;
  }

  @Post("logout")
  async logout() {
    return { ok: true };
  }

  @Post("mail-test")
  async mailTest() {
    const res = await this.mailService.sendEmail({
      to: process.env.ADMIN_EMAIL || "admin@lecreuset.fr",
      subject: "Test SMTP - Mailhog",
      text: "Ceci est un email de test envoyé via SMTP (Mailhog).",
      html: "<p>Ceci est un email de <strong>test</strong> envoyé via SMTP (Mailhog).</p>",
    });
    return { ok: res.success, id: res.id };
  }
}
