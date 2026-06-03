# site-handicap

Projet front statique + backend Node/Express pour HandiRepere.

## Lancer le projet

1. Renseigner `backend/.env` avec ces variables :
   `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`
2. Installer les dépendances du backend si besoin :
   `cd backend`
   `npm install`
3. Démarrer le serveur :
   `npm start`
4. Ouvrir le site :
   `http://localhost:3000/pageAccueil/index.html`

## Authentification

L'inscription et la connexion passent maintenant par l'API `POST /api/users/register`
et `POST /api/users/login`, avec mots de passe hachés via `bcrypt`.

## Rendez-vous

Les rendez-vous sont enregistrés dans la même base PostgreSQL que le reste du projet.
Il n'y a donc pas besoin d'une seconde base dédiée : le backend crée et utilise une
table `appointments` au démarrage du serveur si la configuration `backend/.env` est valide.
