# EduFlow

Application de gestion scolaire orientee finance:
- eleves, classes, mensualites, paiements, impayes,
- administration multi-roles (`super_admin`, `admin`, `user`),
- API PHP + frontend React.

## Repository
- GitHub: `https://github.com/Yassinox0/EduFlow.git`

## Stack technique
- Frontend: React + Vite
- Backend: PHP 8.x (API REST)
- Base de donnees: MySQL 8 (Docker recommande)

## Prerequis
- Git
- Node.js + npm
- PHP 8.x
- Composer
- Docker Desktop (ou Docker Engine)
- Client MySQL (`mysql` CLI) recommande

## 1) Cloner le projet
```bash
git clone https://github.com/Yassinox0/EduFlow.git
cd EduFlow
```

## 2) Demarrer MySQL (Docker)
```bash
docker run -d --name salma-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=salma_project -p 3307:3306 mysql:8.0
```

Verifier:
```bash
docker ps
```

## 3) Initialiser la base
Importer la structure:
```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < backend/storage/01_schema.sql
```

Importer les donnees:
```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < backend/storage/02_data_dump.sql
```

## 4) Configurer le backend
Fichier `backend/.env`:
```env
APP_ENV=local
APP_DEBUG=true
APP_NAME="Salma Project"
APP_URL=http://localhost
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=salma_project
DB_USER=root
DB_PASS=root
JWT_SECRET=salma_super_secret_key
JWT_TTL=86400
```

Installer les dependances backend:
```bash
cd backend
composer install
```

## 5) Lancer le backend
Option Windows:
```bash
./start-backend.ps1
```

Option manuelle:
```bash
cd backend
php -S 127.0.0.1:8080 -t public public/index.php
```

## 6) Configurer le frontend
Fichier `frontend/.env`:
```env
VITE_API_URL=http://127.0.0.1:8080
VITE_BRAND_NAME=EduFlow
VITE_SCHOOL_NAME=Votre ecole
```

Installer et lancer:
```bash
cd frontend
npm install
npm run dev
```

URL frontend: `http://localhost:5173`

## 7) Comptes de test
- super admin: `owner@eduflow.com` / `owner123`
- admin: `yassine.benmansour@miranda.com` / `admin123`
- user: `salma@miranda.com` / `user123`

## 8) Reset mot de passe (super admin)
Endpoint:
- `POST /api/users/{id}/reset-password`

Mot de passe applique apres reset:
- `EduFlow@123`

Regles:
- seul `super_admin` peut reset les comptes,
- le super admin ne peut pas reset son propre compte via ce bouton.

## 9) Fonctionnalites importantes ajoutees
- scripts DB canoniques:
  - `backend/storage/01_schema.sql`
  - `backend/storage/02_data_dump.sql`
- classes:
  - saisie du nom uniquement,
  - `code` + `sort_order` auto-generes en sequence.
- eleves:
  - creation,
  - modification,
  - suppression.
- impayes:
  - exclut les dossiers `PAID`,
  - calcule une date d'echeance,
  - tri chronologique par urgence.
- dashboard:
  - KPIs,
  - paiements recents,
  - top impayes.

## 10) Partager la base a une autre personne
### Methode recommandee
Partager le repo + les 2 scripts SQL (`01_schema.sql`, `02_data_dump.sql`).

### Methode snapshot container (exact)
Creer une image a partir du container:
```bash
docker commit salma-mysql eduflow-mysql:snapshot
```

Exporter l'image:
```bash
docker save -o eduflow-mysql-snapshot.tar eduflow-mysql:snapshot
```

Chez l'autre personne:
```bash
docker load -i eduflow-mysql-snapshot.tar
docker run -d --name salma-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=salma_project -p 3307:3306 eduflow-mysql:snapshot
```

## 11) Depannage rapide
- Login "Identifiants invalides ou API indisponible":
  - verifier backend sur `127.0.0.1:8080`,
  - verifier `VITE_API_URL`,
  - verifier que MySQL tourne.
- Erreurs SQL / tables manquantes:
  - reimporter `01_schema.sql`, puis `02_data_dump.sql`.
- Port MySQL occupe:
  - changer `-p 3307:3306` et `DB_PORT` en consequence.
