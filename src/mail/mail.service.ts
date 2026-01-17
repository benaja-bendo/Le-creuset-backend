import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  id: string;
  success: boolean;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('MAIL_FROM', 'noreply@example.com');
  }

  /**
   * Send an email using Resend
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
      });

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`);
        return { id: '', success: false };
      }

      this.logger.log(`📧 Email sent successfully: ${data?.id}`);
      return { id: data?.id ?? '', success: true };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return { id: '', success: false };
    }
  }

  /**
   * Send a quote confirmation email
   */
  async sendQuoteConfirmation(
    to: string,
    quoteRef: string,
    quoteUrl: string,
  ): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: `Votre demande de devis #${quoteRef}`,
      html: `
        <h1>Demande de devis reçue</h1>
        <p>Bonjour,</p>
        <p>Nous avons bien reçu votre demande de devis (référence: <strong>${quoteRef}</strong>).</p>
        <p>Vous pouvez suivre l'état de votre demande ici: <a href="${quoteUrl}">${quoteUrl}</a></p>
        <p>Nous reviendrons vers vous rapidement.</p>
        <p>Cordialement,<br/>L'équipe Le Creuset</p>
      `,
      text: `Demande de devis reçue\n\nRéférence: ${quoteRef}\nSuivi: ${quoteUrl}`,
    });
  }

  /**
   * Send a notification to admin about new quote
   */
  async sendAdminNotification(
    quoteRef: string,
    customerEmail: string,
    fileCount: number,
  ): Promise<EmailResult> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL', 'admin@lecreuset.fr');

    return this.sendEmail({
      to: adminEmail,
      subject: `Nouvelle demande de devis #${quoteRef}`,
      html: `
        <h1>Nouvelle demande de devis</h1>
        <ul>
          <li><strong>Référence:</strong> ${quoteRef}</li>
          <li><strong>Client:</strong> ${customerEmail}</li>
          <li><strong>Fichiers:</strong> ${fileCount}</li>
        </ul>
      `,
    });
  }
}
