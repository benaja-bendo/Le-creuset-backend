/**
 * Suggère le prochain numéro séquentiel "PREFIX-ANNÉE-0001", remis à zéro
 * chaque année civile. Lecture seule (ne réserve rien en base) : deux appels
 * concurrents peuvent suggérer le même numéro si aucune commande/facture n'a
 * encore été créée entre les deux — la contrainte @unique tranche à
 * l'écriture (voir `rethrowUniqueConstraint`).
 *
 * Le classement lexicographique du padding ("0001" < "0002" < … < "9999")
 * ne reste fiable qu'en dessous de 10 000 numéros par an et par préfixe —
 * largement suffisant à l'échelle de cette fonderie.
 */
export async function suggestNextNumber(
  findLatest: (yearPrefix: string) => Promise<string | null | undefined>,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${prefix}-${year}-`;
  const latest = await findLatest(yearPrefix);
  const lastSeq = latest ? parseInt(latest.slice(yearPrefix.length), 10) : 0;
  const nextSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
  return `${yearPrefix}${String(nextSeq).padStart(4, "0")}`;
}
