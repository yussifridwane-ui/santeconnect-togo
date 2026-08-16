# 🛡️ SECURITY AUDIT — SANTÉONLINE

- **Date de l'audit :** 16 août 2026
- **Périmètre :** https://santeonline.netlify.app (+ dépôts GitHub jumeaux, Netlify, Neon Postgres)
- **Type :** audit défensif, lecture de code + tests boîte noire, **zéro destruction de données**
- **Version corrigée :** V2.8 (commit `a4adeed`)

---

## 1. Architecture analysée

| Couche | Technologie | État sécurité |
|---|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind | Échappement React par défaut ✓ (+ échappement manuel ajouté sur les impressions) |
| Backend | Next.js API routes (serverless Netlify) | Correction des contrôles d'autorisation (voir §3) |
| Base de données | Neon Postgres (pool pg, requêtes paramétrées) | SQLi : **aucune injection possible** ✓ |
| Authentification | Cookie `session` — JWT HS256 (jose, 7 j) + bcryptjs | Durcie V2.8 ✓ |
| Stockage fichiers | Documents base64 en base (≤ 1,8 Mo) | Liste blanche mime + inline contrôlé ✓ |
| Services externes | Brevo (e-mail/SMS), Twilio (WhatsApp, optionnel), CinetPay (abonnement) | Secrets côté serveur uniquement ✓ |

**Rôles :** `patient`, `admin`, `doctor`, `nurse`, `secretary`, `lab`, `pharmacist`.
**Données sensibles :** identité, coordonnées, dossiers médicaux (conditions, allergies, médicaments, antécédents), consultations (diagnostics), ordonnances, résultats d'examens (labo/imagerie), facturation, documents cliniques, journal de santé.

---

## 2. Vulnérabilités détectées et corrigées

### 🔴 CRITIQUES (3)

| # | Faille | Cause | Correctif |
|---|---|---|---|
| C1 | **Escalade de privilèges à l'inscription** : le champ `role` du client était accepté tel quel + `facilityId` libre → création d'un compte *doctor* rattaché à la clinique n°1 | Confiance dans des données frontend | Register n'accepte plus que `patient` ou `admin` (admin = création de SON propre établissement obligatoire) ; `facilityId` client ignoré |
| C2 | **Suppression de fiche patient sans contrôle de rôle** : DELETE acceptait TOUT utilisateur connecté | Absence de gate RBAC | DELETE = admin uniquement + même établissement |
| C3 | **Liste complète des patients lisible par un compte patient** | GET /api/patients sans contrôle de rôle | Accès réservé au personnel |

### 🟠 ÉLEVÉES (4)

| # | Faille | Correctif |
|---|---|---|
| E1 | Messagerie : `senderId` du client accepté (usurpation d'identité) et lecture des messages d'autrui via `?userId=` | sender/facility forcés depuis la session serveur ; lecture limitée à ses propres messages |
| E2 | Anti brute-force login uniquement en mémoire (inefficace en serverless multi-instances) | Verrouillage **persistant en base** : 5 échecs → gel 15 min (`login_fails`, `login_locked_until`), reset au succès |
| E3 | Secret JWT de secours codé en dur dans 4 modules (auth, dossier, reminders, rdv-lien) — si la variable manquait, sessions falsifiables | En production, `JWT_SECRET` est désormais **obligatoire** (erreur sinon) ; fallback possible uniquement en développement local |
| E4 | GET /api/doctors livrait emails + téléphones du personnel à tout compte (patients compris) | Patients : nom + établissement uniquement (minimisation des données) |

### 🟡 MOYENNES (5)

| # | Faille | Correctif |
|---|---|---|
| M1 | Création de RDV : `patientId` client accepté pour un compte patient (IDOR) | Patient : ID dérivé de la session, statut forcé `pending` |
| M2 | Upload documents : mime non filtré (SVG/HTML piégés possibles) | Liste blanche PDF/JPG/PNG/WEBP + cohérence mime/contenu vérifiée ; déjà limité à 1,8 Mo |
| M3 | Téléchargement : `Content-Type` inline sur mime stocké potentiellement dangereux | Inline uniquement PDF/images sûrs ; sinon octet-stream + attachment + `nosniff` |
| M4 | XSS stockée possible dans les fenêtres d'impression (noms/libellés injectés dans `document.write`) | Échappement systématique (`esc()`) sur factures, feuilles de soins, ordonnances |
| M5 | Absence de headers de sécurité avancés | HSTS 1 an, CSP (frame-ancestors 'none'), Permissions-Policy, nosniff, Referrer-Policy |

### 🟢 FAIBLES (renforcé)

- Rate limiting ajouté : register (5/heure/IP), messagerie (30/min/utilisateur). Le code dossier patient était déjà verrouillé (5 échecs → 10 min) ✓.
- Audit enrichi : connexions réussies + verrouillages de compte sont désormais journalisés dans `audit_log` (append-only, déjà existant).
- Politique de mot de passe : 6 caractères minimum à l'inscription.

### ✅ Points forts confirmés (pas de faille)

- **SQLi** : 100 % de requêtes paramétrées (pg pool + drizzle) — aucune concaténation de requête avec des données client.
- **Mots de passe** : bcryptjs (jamais en clair) ; code dossier patient haché bcrypt.
- **Cookies** : `HttpOnly` + `Secure` (production) + `SameSite=Lax` (mitigation CSRF classique).
- **Journal d'audit** : append-only, aucune route ne modifie/supprime les entrées.
- **Cron des rappels** : protégé par `CRON_SECRET` (401 sans le bon secret).
- **CORS** : aucun `Access-Control-Allow-Origin: *` — API same-origin.
- **Secrets** : BREVO/TWILIO/DATABASE_URL/JWT_SECRET côté serveur (variables Netlify), jamais dans le bundle frontend.

---

## 3. Tests de sécurité automatisés

Fichier : `security_tests/run_security_tests.py` — 26 contrôles :

1. ✅ Patient A ne peut pas consulter/modifier le dossier du patient B (403 partout)
2. ✅ Patient bloqué sur les routes personnel (`/api/patients`, `/api/invoices`…)
3. ✅ Patient bloqué sur les routes admin (`/api/team`, `/api/audit`…)
4. ✅ Utilisateur anonyme : 401 sur les 11 endpoints privés testés
5. ✅ Jeton de confirmation RDV falsifié → 401 propre (pas de stack trace)
6. ✅ Document médical : 401 sans session, jamais d'URL devinable publique
7. ✅ Brute-force : 6e tentative de connexion → 429 (verrouillage)
8. ✅ Headers : `x-content-type-options`, `x-frame-options`, `strict-transport-security`, `content-security-policy`, `referrer-policy`, `permissions-policy`
9. ✅ CORS : pas de `*` permissif
10. ✅ Robot rappels : refus sans secret et avec mauvais secret

## 4. Fichiers modifiés (V2.8)

`src/lib/auth.ts` · `src/lib/dossier.ts` · `src/lib/reminders.ts` · `src/app/api/rdv-lien/route.ts` · `src/app/api/auth/register/route.ts` · `src/app/api/auth/login/route.ts` · `src/app/api/patients/route.ts` · `src/app/api/patients/[id]/route.ts` · `src/app/api/patients/[id]/documents/route.ts` · `src/app/api/documents/[id]/route.ts` · `src/app/api/doctors/route.ts` · `src/app/api/appointments/route.ts` · `src/app/api/messages/route.ts` · `src/app/dashboard/facturation/page.tsx` · `src/db/migrate.ts` · `netlify.toml` · **ajouts** : `security_tests/run_security_tests.py`, `SECURITY_AUDIT.md`

## 5. Checklist finale

- [x] Authentification sécurisée (bcrypt + verrouillage persistant + session JWT courte durée)
- [x] Autorisation serveur (gates vérifiés côté API sur tous les endpoints audités)
- [x] Isolation patient/médecin (dossier derrière code T-Money, RDV propres)
- [x] Isolation des dossiers médicaux (jeton déverrouillage 15 min)
- [x] API sécurisée (401/403 systématiques, minimisation des réponses)
- [x] Base de données sécurisée (requêtes paramétrées — RLS non applicable : accès serveur dédié, pas d'accès direct client à Postgres)
- [x] RLS si applicable → N/A (architecture serveur ; isolation faite au niveau API par session)
- [x] XSS protégé (React + esc() sur les impressions)
- [x] CSRF protégé (SameSite=Lax — les POST cross-site ne portent pas le cookie)
- [x] CORS sécurisé (same-origin, jamais `*`)
- [x] Upload sécurisé (liste blanche + taille + inline contrôlé)
- [x] Secrets protégés (env serveur uniquement, production durcie)
- [x] Rate limiting (login, register, messages, code dossier)
- [x] Headers de sécurité (HSTS, CSP, nosniff, frame-ancestors…)
- [x] Logs sécurisés (audit append-only sans mot de passe/token/données médicales détaillées)
- [x] Dépendances : pas de paquet suspect détecté dans package.json (next, react, drizzle, jose, bcryptjs, lucide, date-fns)
- [x] HTTPS (Netlify + HSTS)
- [x] Tests automatisés (26 contrôles rejouables)
- [x] Production vérifiée (endpoints live testés)

## 6. Risques résiduels (honnêteté professionnelle)

1. **Session JWT stateless** : un cookie volé reste valable jusqu'à son expiration (7 j). Pas de révocation instantanée centralisée. Piste : table de révocation / durée réduite.
2. **Rate limiting « mémoire »** : best-effort en serverless (chaque instance a sa mémoire) ; les verrous critiques (login, code dossier) sont **persistants en base**, ceux-ci couvrent le risque majeur.
3. **Mots de passe 6 caractères** : politique volontairement accessible ; recommandé prochainement : 10+ caractères avec complexité pour les comptes personnel.
4. **Chiffrement au repos** : assuré par l'infrastructure Neon (chiffrement disque), pas de chiffrement applicatif champ par champ. Pour un niveau « hôpital », un chiffrement applicatif des champs médicaux peut être envisagé en V3.
5. **Audit externe** : un pentest professionnel indépendant reste recommandé avant toute mise en production hospitalière à grande échelle (normes, RGPD/localisation des données de santé au Togo).

*Aucune application n'est « 100 % sécurisée » — cet audit couvre les vulnérabilités OWASP classiques (IDOR/BOLA, injection, XSS, CSRF, CORS, brute-force, exposition de secrets) avec des correctifs côté serveur et des tests de non-régression automatisés.*
