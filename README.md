# 🏥 SantéConnect Togo — Plateforme Médicale de Ridwane Issifou

Bienvenue sur **SantéConnect Togo**, l'application full-stack moderne de gestion de cabinets médicaux, cliniques, laboratoires et hôpitaux au Togo, créée et gérée par **Ridwane Issifou**.

Cette plateforme est conçue pour optimiser la communication médicale et planifier automatiquement des rendez-vous avec un système intégré de rappels instantanés par **WhatsApp**.

---

## ⚡ Déploiement Permanent et Gratuit en 1 Clic !

### 🟢 Option 1 : Déployer sur Netlify (Recommandé)

Le fichier `netlify.toml` est déjà configuré dans ce projet. Cliquez sur le bouton, puis renseignez **vous-même** les variables `DATABASE_URL` et `JWT_SECRET` dans l'interface Netlify (elles ne doivent **jamais** être publiées dans ce dépôt) :

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yussifridwane-ui/santeconnect-togo)

### 🔵 Option 2 : Déployer sur Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yussifridwane-ui/santeconnect-togo&env=DATABASE_URL,JWT_SECRET&envDescription=Variables%20obligatoires%20%3A%20cha%C3%AEne%20de%20connexion%20PostgreSQL%20et%20cl%C3%A9%20secr%C3%A8te%20JWT.&project-name=santeconnect-togo&repository-name=santeconnect-togo)

---

## 🌟 Fonctionnalités Majeures

1. **Isolation Absolue par Cabinet** : Chaque cabinet, clinique ou hôpital enregistré accède à un espace hermétique. Les dossiers médicaux, patients et rendez-vous d'un cabinet sont invisibles pour les autres.
2. **Tableau de bord interactif** : Suivi des statistiques clés (patients inscrits, rendez-vous du jour et de la semaine).
3. **Rappels WhatsApp Automatiques** : Génération de messages professionnels pré-remplis en français, envoyés directement aux patients en un clic.
4. **Messagerie Sécurisée** : Système d'envoi et de réception de messages internes.
5. **Dossiers Médicaux & Prescriptions** : Suivi complet de l'historique de santé des patients.

---

## 🛠️ Variables d'environnement (À GARDER SECRÈTES)

Ces variables se configurent **uniquement** dans le panneau de votre hébergeur (Netlify / Vercel). Ne les commitez jamais dans ce dépôt. Exemples génériques :

*   **`DATABASE_URL`** :
    `postgresql://utilisateur:mot_de_passe@hote:5432/nom_de_base?sslmode=require`
*   **`JWT_SECRET`** :
    `votre_cle_secrete_jwt_ici`

> ⚠️ **Sécurité** : si une valeur réelle venait à être exposée publiquement, faites-la pivoter immédiatement (nouveau mot de passe base de données + nouvelle clé JWT).

---

## 👨‍💻 Créateur & Administrateur

*   **Nom** : Ridwane Issifou
*   **Rôle** : Créateur, Développeur & Administrateur Système
*   **Accès administrateur** : les identifiants de connexion sont communiqués **privément** par l'administrateur et ne sont jamais publiés dans ce dépôt.
