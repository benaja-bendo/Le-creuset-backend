import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../mail/mail.service";
import { escapeHtml } from "../common/escape-html";
import { ContactDto } from "./dto/contact.dto";

const DEFAULT_CONTACT_EMAIL = "contact@lagrenaille.fr";

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Transmet à l'atelier un message du formulaire de la vitrine. L'email
   * porte l'adresse du visiteur en Reply-To : l'atelier lui répond depuis sa
   * messagerie, sans recopier l'adresse.
   */
  async send(dto: ContactDto): Promise<void> {
    // Pot de miel rempli = robot. On répond comme pour un envoi réussi, pour
    // ne pas lui apprendre que le piège existe.
    if (dto.website) {
      this.logger.warn("Message de contact ignoré : pot de miel rempli");
      return;
    }

    // `||` plutôt que le défaut de get() : une variable déclarée mais vide
    // doit aussi retomber sur l'adresse de l'atelier.
    const to =
      this.configService.get<string>("CONTACT_EMAIL") || DEFAULT_CONTACT_EMAIL;
    const company = dto.company || "";
    // Nom et société vont dans l'objet : une seule ligne, quoi qu'on y tape.
    const from = (company || dto.name).replace(/\s+/g, " ");

    const name = escapeHtml(dto.name);
    const email = escapeHtml(dto.email);
    const message = escapeHtml(dto.message).replace(/\r?\n/g, "<br />");

    const result = await this.mailService.sendEmail({
      to,
      replyTo: dto.email,
      subject: `Demande de contact — ${from}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a1a;">Nouveau message depuis le site</h1>
          <ul style="padding-left: 20px;">
            <li><strong>Nom :</strong> ${name}</li>
            ${company ? `<li><strong>Société :</strong> ${escapeHtml(company)}</li>` : ""}
            <li><strong>Email :</strong> ${email}</li>
          </ul>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; line-height: 1.5;">
            ${message}
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Répondez directement à cet email : la réponse partira à ${email}.
          </p>
        </div>
      `,
      text: [
        "Nouveau message depuis le site",
        "",
        `Nom : ${dto.name}`,
        ...(company ? [`Société : ${company}`] : []),
        `Email : ${dto.email}`,
        "",
        dto.message,
      ].join("\n"),
    });

    if (!result.success) {
      throw new ServiceUnavailableException(
        "Le message n'a pas pu être envoyé. Réessayez dans quelques minutes.",
      );
    }
  }
}
