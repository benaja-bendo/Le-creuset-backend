-- Trace de saisie pour les mouvements de compte poids (audit §4.4) :
-- `Transaction` n'avait que `date` (fournie par l'appelant, potentiellement
-- une correction rétroactive), pas de date d'enregistrement. Sert aussi de
-- départage déterministe pour `orderBy: { date: 'desc' }` (weights.service.ts)
-- quand plusieurs mouvements partagent la même `date` saisie à la journée.
-- Les lignes existantes reçoivent la date de la migration : on ne peut pas
-- reconstituer leur vraie date de saisie a posteriori.
ALTER TABLE "transactions" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
