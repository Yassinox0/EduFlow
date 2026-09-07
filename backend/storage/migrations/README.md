# Database migrations

This directory is the authoritative history of database structure and shared
reference data.

## Apply migrations

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\migrate-database.ps1
```

Check status without modifying the database:

```powershell
powershell -ExecutionPolicy Bypass -File .\migrate-database.ps1 -Status
```

## Creating a migration

Use an ordered filename:

```text
YYYY_MM_DD_NNN_short_description.sql
```

Example:

```text
2026_09_03_001_create_academic_years.sql
```

Rules:

1. Never edit or rename a migration after it has been pushed.
2. Create a new migration for every later correction.
3. Include schema changes and deterministic reference data only.
4. Never commit real students, parents, payments, credentials, or database dumps.
5. Test migrations on a backup before merging.
6. Commit the migration with the backend code that depends on it.

## Collaboration workflow

```powershell
git pull
powershell -ExecutionPolicy Bypass -File .\migrate-database.ps1
```

All collaborators then have the same schema version. Their private development
records remain local.
