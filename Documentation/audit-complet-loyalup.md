# Audit fonctionnel et technique de Looyaal

**Date :** 9 août 2026  
**Périmètre :** application React, parcours métier, Supabase, Edge Functions, migrations, tests, PWA et chaîne de livraison.  
**Nature de l'audit :** analyse statique du dépôt et exécution des contrôles locaux disponibles. Aucun test destructif n'a été exécuté contre la production.

## 1. Conclusion exécutive

Looyaal contient les principaux parcours annoncés : authentification multi-rôles, onboarding, QR, validation marchande, points, récompenses, réseaux, transferts, gamification, parrainage, administration et intégration SumUp.

Le projet **compile**, mais il ne peut pas être déclaré fonctionnellement prêt pour la production dans son état audité :

- la suite automatisée est désormais verte : **98 tests réussissent sur 98**, avec des avertissements React `act(...)` restant à nettoyer ;
- le lint n'est pas vert : **131 erreurs et 33 avertissements** ;
- les défauts critiques de transfert ont été corrigés et déployés : identité dérivée du JWT, mutation atomique, verrou par client et idempotence liée au payload ;
- la consommation QR atomique et l'unicité d'une transaction par jeton ont été déployées ;
- les parcours gamification, réseau, administration et partenaires sont très peu couverts par des tests ;
- la CI exécute les tests et le build sous Node.js 22, mais pas encore le lint.

**Verdict : GO conditionnel** pour les correctifs déployés. La mise en production complète du parcours financier reste conditionnée à un test de concurrence authentifié sur données de recette et à la recette QR → validation → points.

### Avancement de la remédiation

| Correctif | État au 9 août 2026 | Validation disponible |
|---|---|---|
| Autorisation de `transfer-points` | Déployée, fonction v20 | `verify_jwt=true` ; appel sans JWT rejeté en 401 |
| Atomicité et idempotence des transferts | RPC déployée | Index et ACL vérifiés ; concurrence authentifiée à tester |
| Insertion RLS directe dans `point_transfers` | Supprimée en production | Policy absente après migration |
| Consommation QR atomique et unique | Déployée, fonction v22 | Index unique présent ; 162 transactions conservées ; appel sans JWT rejeté en 401 |
| CI tests et build | Workflow `quality.yml` ajouté | Validation GitHub Actions au prochain push/PR |

Migrations ajoutées :

- `20260809040918_secure_atomic_point_transfers.sql` ;
- `20260809040931_restrict_transfer_rpc_execute.sql` ;
- `20260809040956_atomic_qr_consumption.sql`.

Les migrations ont été appliquées au projet Supabase `yyftqivizzgvveeczbpv` via MCP après contrôle des préconditions. Les RPC `transfer_points_transaction` et `consume_qr_token` sont exécutables par `service_role` uniquement, sans droit pour `anon` ni `authenticated`. Les advisors ne signalent aucune des deux nouvelles RPC. Le passif existant reste important : 3 vues `SECURITY DEFINER` en erreur et 66 alertes d'exécution de fonctions privilégiées par les rôles API.

## 2. Méthode et preuves

### Contrôles exécutés

| Contrôle | Résultat observé | Interprétation |
|---|---:|---|
| `npm run build` | Succès | TypeScript et bundle de production générés |
| `npm.cmd run test:run` | Succès : 15 fichiers, 98 tests | Suite complète verte après remédiation |
| `npm run lint` | Échec : 164 problèmes | 131 erreurs, 33 avertissements |
| Inspection routes/services/hooks | Effectuée | Parcours présents dans le code |
| Inspection Edge Functions/RLS | Effectuée | Défauts P0/P1 confirmés statiquement |
| Tests Supabase non destructifs | Réussis | Schéma, index, ACL, erreurs RPC et rejet HTTP 401 vérifiés |
| Tests Supabase métier/concurrence | Non exécutés | Nécessitent comptes et données de recette contrôlées |
| QA navigateur multi-écrans | Non exécutée | À réaliser avec comptes de recette et appareils ciblés |

Une fonctionnalité présente dans le code n'est donc pas considérée comme validée sans test automatisé réussi ou recette réelle documentée.

## 3. Matrice fonctionnelle

| Domaine | Implémentation observée | Preuve automatisée | État d'audit |
|---|---|---|---|
| Authentification email/OAuth | Services, store et routes protégées présents | Tests auth présents et passants | **Partiellement validé** |
| Autorisation par rôle | Client, fournisseur, admin, super-admin, institution | Pas de test de `ProtectedRoute` ni des redirections par rôle | **À valider** |
| Onboarding | Routeur et étapes présents | Pas de test fonctionnel du parcours complet | **À valider** |
| Génération QR | Service, hook et Edge Function présents | Tests service/génération passants | **Partiellement validé** |
| Scan et validation QR | Hook, fonction v22 et RPC atomique déployés | Tests hook/service/flux passants ; ACL/index vérifiés | **Partiellement validé** |
| Validation marchande/points | UI, service, RPC et Edge Function présents | Tests `ValidationPanel` passants avec avertissements `act(...)` | **Partiellement validé** |
| Récompenses | Catalogue, déblocage, présence physique, realtime | Tests service et composants passants | **Partiellement validé** |
| Promotions | Carte et expiration présentes | Tests d'affichage passants | **Partiellement validé** |
| Réseaux/transferts | Services, fonction v20 et RPC atomique déployés | Contrôles non destructifs passants ; concurrence métier à tester | **Partiellement validé** |
| Gamification | XP, badges, défis, streak, leaderboard | Aucun test métier dédié trouvé | **Non validé** |
| Parrainage | Génération, activation et statistiques présents | Pas de couverture fonctionnelle complète | **À valider** |
| SumUp | OAuth, vérification, transactions et sandbox présents | Tests du hook passants ; OAuth réel non testé | **Partiellement validé** |
| Administration/institution | Routes et consoles présentes | Pas de scénario multi-rôles complet | **À valider** |
| PWA/offline | Manifest, service worker et caches présents | Build PWA réussi ; pas de test offline réel | **Partiellement validé** |

## 4. Anomalies prioritaires

### P0-1 — Transfert de points sans autorisation métier — corrigé et déployé

**Preuve :** `supabase/functions/transfer-points/index.ts` utilise directement la clé `SUPABASE_SERVICE_ROLE_KEY`, accepte `client_id` dans le corps et ne valide jamais le JWT ni l'identité du client appelant. Le frontend envoie bien un bearer token, mais la fonction ne le lit pas.

**Impact :** un appelant capable d'atteindre la fonction peut tenter de transférer les points d'un autre client en fournissant son identifiant.

**Correction recommandée :**

1. Lire et vérifier le bearer token avec `auth.getUser()`.
2. Refuser tout `client_id` différent de l'utilisateur authentifié ; idéalement, supprimer `client_id` du payload.
3. Vérifier explicitement le rôle autorisé.
4. Ajouter des tests : sans JWT, JWT invalide, autre client, solde insuffisant et transfert légitime.

**Critère d'acceptation :** toute tentative portant sur un autre client retourne `403` et ne modifie aucune table.

### P0-2 — Transfert non atomique et non idempotent — corrigé et déployé, à valider en concurrence

**Preuve :** la même Edge Function enchaîne lecture du solde, débit, crédit et insertion d'historique par appels séparés. Les « rollbacks » sont eux-mêmes des mises à jour séparées. Deux appels concurrents peuvent lire le même solde, et une coupure peut laisser un état partiel. Aucune clé d'idempotence n'est utilisée.

**Impact :** double débit/crédit, perte de points, historique incohérent ou écrasement de solde concurrent.

**Correction recommandée :** déplacer toute l'opération dans une fonction PostgreSQL transactionnelle avec verrouillage des lignes (`FOR UPDATE`), contrôle du solde, écritures atomiques et clé d'idempotence unique.

**Critère d'acceptation :** 20 requêtes concurrentes avec la même clé produisent exactement un transfert et un historique ; une erreur provoquée laisse les soldes inchangés.

### P0-3 — Validation QR vulnérable à une course concurrente — corrigée et déployée, à valider en concurrence

**Preuve :** `validate-qr` lit un jeton actif, insère une `pending_transaction`, puis marque le jeton utilisé. La migration `20260226100000_qr_tokens_pending_transactions.sql` ne crée aucune contrainte unique sur `pending_transactions.qr_token_id`.

**Impact :** deux requêtes simultanées peuvent créer deux transactions pour un seul QR.

**Correction recommandée :** créer une RPC atomique qui consomme le jeton et crée la transaction dans la même transaction SQL. Ajouter au minimum une contrainte `UNIQUE (qr_token_id)`.

**Critère d'acceptation :** sur 20 validations concurrentes d'un jeton, une seule réussit ; les autres retournent un conflit métier sans création supplémentaire.

### P0-4 — Suite de tests en échec — remédiée

**Résultat initial :** 90 réussis, 8 échoués, répartis dans 5 fichiers.

- `useQRScan.test.ts` : 2 échecs, mock realtime incomplet (`subscribeToTransactionStatus`).
- `ValidationPanel.test.tsx` : timeout du bouton sans prix et signature d'appel devenue différente.
- `useSumUpConnection.test.ts` : déconnexion attendue non observée par le test.
- `loyaltyService.test.ts` : balance partenaire retourne HTTP 401.
- `PromoCard.test.tsx` : 2 attentes de classes obsolètes ou régression visuelle.

Les cinq harnais de test ont été remis en cohérence avec les contrats actuels : mocks realtime, handler de balance partenaire, signature de validation, assertions visuelles et test comportemental de déconnexion SumUp.

**Résultat actuel :** `npm run test:run` retourne un code 0 avec 98/98 tests réussis. Les avertissements React `act(...)` de `ValidationPanel.test.tsx` restent à supprimer.

## 5. Risques élevés

### P1-1 — Politique RLS trop permissive sur l'historique des transferts

La migration `20260226000000_week10_gamification.sql` autorise tout utilisateur authentifié à insérer dans `point_transfers` avec `WITH CHECK (true)`.

Cette insertion ne modifiait pas directement les soldes, mais permettait de fabriquer un historique si l'accès PostgREST à la table était disponible. La policy authentifiée a été supprimée en production ; l'écriture passe désormais par la RPC réservée au `service_role`.

### P1-2 — Couverture insuffisante des fonctions métier sensibles

Aucun test dédié n'a été trouvé pour les transferts réseau et la majorité de la gamification : XP, badges, défis, streak, leaderboard et parrainage. Les tests frontend existants mockent Supabase et ne démontrent pas les garanties transactionnelles/RLS du backend.

Priorité de couverture :

1. transferts et concurrence ;
2. consommation QR et crédit de points ;
3. récompenses avec présence physique ;
4. attribution XP/badges/défis ;
5. isolation client/fournisseur/admin/institution.

### P1-3 — CI incomplète — tests et build ajoutés

Le workflow `.github/workflows/quality.yml` exécute désormais `npm ci`, les 98 tests et le build sur les pull requests et les pushes vers `main`. L'audit de secrets reste assuré par `.github/workflows/security-secrets.yml`.

Le lint n'est pas encore une gate, car la dette existante ferait échouer immédiatement toute pull request. Après sa remédiation, ajouter :

```bash
npm run lint
```

Ajouter ensuite un job Supabase local pour appliquer les migrations et exécuter les tests de fonctions/RLS.

### P1-4 — Lint non maîtrisé

Le lint relève 131 erreurs et 33 avertissements. Les catégories observées incluent :

- mises à jour synchrones d'état dans des effets React ;
- accès ou mutation de refs pendant le rendu ;
- expressions inutilisées ;
- dépendances de hooks manquantes ;
- code Edge Function inutilisé ou désactivé avec `@ts-nocheck` ;
- expression toujours vraie dans `update-challenges`.

Toutes ne sont pas des pannes fonctionnelles, mais certaines peuvent produire des rendus en cascade, états périmés ou comportements non déterministes.

## 6. Performance et PWA

Le build PWA réussit et génère le service worker. Les éléments les plus lourds observés sont :

| Chunk | Taille brute | Gzip |
|---|---:|---:|
| `QRScannerPage` | ~385 kB | ~113 kB |
| graphe Recharts | ~366 kB | ~98 kB |
| chunk principal | ~348 kB | ~100 kB |
| client Supabase | ~163 kB | ~43 kB |
| `AdminDashboard` | ~110 kB | ~26 kB |

La séparation par route existe déjà, mais le scanner reste lourd pour un parcours mobile prioritaire. Mesurer sur un appareil milieu de gamme et réseau limité avant d'établir un budget. Le PWA utilise encore `vite.svg` comme icône 192/512/180 ; des icônes produit bitmap adaptées à chaque plateforme sont recommandées.

## 7. Recette fonctionnelle à exécuter

### Authentification et rôles

- connexion/déconnexion et expiration de session ;
- redirection correcte pour chaque rôle ;
- refus croisé client → marchand, marchand → admin ;
- OAuth annulé, refusé et profil incomplet.

### QR et points

- génération, expiration et renouvellement du QR ;
- scan caméra et saisie manuelle ;
- double scan séquentiel et 20 scans concurrents ;
- validation, annulation, expiration pendant la modale ;
- crédit avec service, montant libre et transaction SumUp ;
- mise à jour realtime du solde côté client.

### Récompenses et transferts

- solde insuffisant et récompense expirée ;
- présence physique requise ;
- double clic/double requête sur déblocage ;
- transfert légitime, autre client, autre coalition et retry identique ;
- cohérence des deux soldes et de l'historique après erreur forcée.

### Responsive et accessibilité

- 360×800, 390×844, 768×1024, 1024×768 et 1366×768 ;
- zoom 110 %, 125 % et 200 % ;
- clavier mobile ouvert, portrait/paysage ;
- navigation clavier, focus des modales et annonces d'erreur ;
- absence de scroll horizontal et actions toujours accessibles.

## 8. Plan de remédiation

### Phase 1 — Blocants sécurité et intégrité

- sécuriser et atomiser `transfer-points` ;
- rendre la consommation QR atomique et unique ;
- fermer l'insertion directe RLS dans `point_transfers` ;
- ajouter les tests de concurrence, autorisation et idempotence.

### Phase 2 — Rétablir les garde-fous

- supprimer les avertissements React `act(...)` restant dans les tests de `ValidationPanel` ;
- traiter en priorité les erreurs lint sur les parcours exécutés ;
- intégrer secrets, lint, tests et build dans la CI ;
- définir un seuil de couverture sur les services métier critiques.

### Phase 3 — Recette réelle

- déployer un environnement de staging isolé ;
- créer des comptes client, fournisseur, admin et institution ;
- exécuter les scénarios multi-rôles et la matrice responsive ;
- enregistrer les résultats, captures, données d'entrée et identifiants de transaction ;
- lancer un smoke test automatique après chaque déploiement.

## 9. Conditions de GO production

Le GO peut être prononcé uniquement lorsque :

- les trois anomalies d'intégrité P0 sont corrigées et testées en concurrence ;
- tests, lint et build sont verts en CI ;
- les migrations sont appliquées sur une base vierge puis vérifiées ;
- les parcours QR → validation → points → récompense sont validés de bout en bout ;
- l'isolation des rôles et des marchands est testée négativement ;
- une recette responsive réelle est signée ;
- monitoring, alertes et procédure de rollback sont opérationnels.

En l'état, le build réussi prouve que l'application est livrable techniquement, mais **ne prouve pas son intégrité fonctionnelle ni sa sûreté en production**.