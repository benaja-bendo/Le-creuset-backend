/**
 * Référence lisible d'une commande, côté serveur.
 *
 * `Order.orderNumber` est le numéro métier — le seul identifiant qu'un client
 * reconnaît. `Order.id` est un `cuid` technique : en montrer un fragment produit
 * une référence qui ne correspond à aucune commande, ce que le client a signalé.
 *
 * Le champ est nullable (commandes antérieures à la migration
 * `20260606110139_add_order_number`) : dans ce cas on annonce explicitement
 * l'absence de numéro plutôt que de maquiller un bout d'identifiant.
 *
 * Doit rester aligné sur `orderRef()` de `front/src/lib/orders.ts` : les deux
 * formats apparaissent côte à côte pour un même client (email et interface).
 */
export function orderReference(order: {
  id: string;
  orderNumber?: string | null;
}): string {
  return order.orderNumber || `Sans n° (${order.id.slice(-6).toUpperCase()})`;
}
