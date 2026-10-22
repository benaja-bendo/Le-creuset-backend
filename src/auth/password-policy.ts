import { z } from "zod";

/**
 * Règle unique pour tout nouveau mot de passe (inscription, réinitialisation,
 * changement depuis le profil) : 8 caractères, sans exigence de majuscule ou
 * de chiffre. La longueur protège mieux que la complexité, et une règle
 * simple évite les mots de passe oubliés.
 *
 * La connexion, elle, ne vérifie jamais la longueur (cf. LoginSchema) : un
 * compte créé sous une ancienne règle doit pouvoir se connecter.
 */
export const MIN_PASSWORD_LENGTH = 8;

export const newPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH, {
  message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
});
