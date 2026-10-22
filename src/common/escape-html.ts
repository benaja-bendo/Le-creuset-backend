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
