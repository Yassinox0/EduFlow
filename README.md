# EduFlow

Plateforme de gestion scolaire orientee suivi financier:
- gestion des eleves et classes,
- mensualites, paiements et impayes,
- administration multi-roles (`super_admin`, `admin`, `user`).

## Repository
- GitHub: `Yassinox0/EduFlow`

## Stack technique
- Frontend: React + Vite
- Backend: PHP (API REST)
- Base de donnees: MySQL 8 (Docker)

## Demarrage rapide

### 1) Cloner le projet
```bash
git clone https://github.com/Yassinox0/EduFlow.git
cd EduFlow
```

### 2) Demarrer MySQL avec Docker
```bash
docker run -d --name salma-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=salma_project -p 3307:3306 mysql:8.0
```

### 3) Importer la base
1. Structure:
```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < backend/storage/01_schema.sql
```
2. Donnees:
```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < backend/storage/02_data_dump.sql
```

### 4) Lancer le backend
Option script Windows:
```bash
./start-backend.ps1
```

Option manuelle:
```bash
cd backend
php -S 127.0.0.1:8080 -t public public/index.php
```

### 5) Lancer le frontend
```bash
cd frontend
npm install
npm run dev
```

## Comptes de test
- `owner@eduflow.com` / `owner123` (super admin)
- `yassine.benmansour@miranda.com` / `admin123` (admin)
- `salma@miranda.com` / `user123` (user)

## Reset mot de passe
Fonctionnalite disponible depuis l'interface Admin (super admin uniquement).

- Endpoint: `POST /api/users/{id}/reset-password`
- Mot de passe applique apres reset: `EduFlow@123`

Regles:
- seul `super_admin` peut reset les comptes,
- le super admin ne peut pas reset son propre mot de passe via ce bouton.

## Correctifs importants realises
- Stabilisation login/API/DB.
- Normalisation base via:
  - `backend/storage/01_schema.sql`
  - `backend/storage/02_data_dump.sql`
  - `backend/storage/migrations/2026_05_11_user_student_payment_upgrade.sql`
- Creation classe simplifiee: saisie du nom uniquement, `code` + `sort_order` auto-sequences.
- Gestion eleves: creation + modification + suppression.
- Impayes: filtrage non-paye, logique d'echeance, tri chronologique.
- Dashboard: KPIs + paiements recents + top impayes.

## Checklist validation
- Login OK (3 roles)
- Creation classe OK
- Creation/modification/suppression eleve OK
- Vue impayes OK
- Reset MDP super admin OK


```
