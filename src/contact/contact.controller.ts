import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ContactService } from "./contact.service";
import { ContactDto } from "./dto/contact.dto";

// Même plafond que les routes publiques d'auth (AUTH_THROTTLE,
// auth.controller.ts) : route ouverte sans authentification dont chaque appel
// envoie un email à l'atelier.
const CONTACT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

// Route publique : formulaire de contact de la vitrine.
@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Throttle(CONTACT_THROTTLE)
  async send(@Body() dto: ContactDto) {
    await this.contactService.send(dto);
    return { ok: true, message: "Message envoyé." };
  }
}
