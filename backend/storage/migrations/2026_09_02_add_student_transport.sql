-- Transport scolaire : choix administratif uniquement, sans génération de frais.
-- La requête préparée rend cette migration sans effet lors d'une seconde exécution.
SET @transport_column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'students'
      AND COLUMN_NAME = 'uses_transport'
);
SET @transport_migration_sql = IF(
    @transport_column_exists = 0,
    'ALTER TABLE students ADD COLUMN uses_transport TINYINT(1) NOT NULL DEFAULT 0 AFTER school_level_id',
    'SELECT 1'
);
PREPARE transport_migration_statement FROM @transport_migration_sql;
EXECUTE transport_migration_statement;
DEALLOCATE PREPARE transport_migration_statement;
