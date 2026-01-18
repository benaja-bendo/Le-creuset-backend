import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

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
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly smtpTransport: nodemailer.Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.configService.get<string>('MAIL_FROM', 'noreply@example.com');
    const host = this.configService.get<string>('SMTP_HOST', '');
    const portStr = this.configService.get<string>('SMTP_PORT', '');
    const port = portStr ? Number(portStr) : 0;
    this.smtpTransport = host && port ? nodemailer.createTransport({ host, port, secure: false, ignoreTLS: true, tls: { rejectUnauthorized: false } }) : null;
  }

  /**
   * Send an email using Resend
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      if (this.resend) {
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
      }
      if (this.smtpTransport) {
        const info = await this.smtpTransport.sendMail({
          from: this.from,
          to: Array.isArray(options.to) ? options.to.join(',') : options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          replyTo: options.replyTo,
        });
        this.logger.log(`📧 SMTP email sent: ${info.messageId}`);
        return { id: info.messageId, success: true };
      }
      this.logger.warn(`Email non envoyé (aucun transport configuré). Sujet: ${options.subject}`);
      return { id: '', success: true };
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

  /**
   * Send welcome email to newly activated user
   */
  async sendWelcomeEmail(to: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: 'Votre compte a été activé',
      html: `
        <h1>Bienvenue</h1>
        <p>Votre compte professionnel a été activé.</p>
        <p>Vous pouvez vous connecter ici: <a href="http://localhost:5173/login">Se connecter</a></p>
      `,
      text: 'Votre compte professionnel a été activé. Connectez-vous: http://localhost:5173/login',
    });
  }
}
