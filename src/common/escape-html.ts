const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Échappe une saisie avant de l'interpoler dans un email HTML. Sans ça, un
 * visiteur du formulaire public peut glisser balises et faux liens dans la
 * boîte de l'atelier.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Ramène une saisie sur une seule ligne avant de l'utiliser dans l'objet d'un
 * email : un saut de ligne n'a rien à faire dans un en-tête.
 */
export function toSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
