# Imported upstream migrations

Source: https://github.com/Yassinox0/EduFlow
Commit: fbaadeb2351a8be2a78490ab45ef8b09232dfd43

The SQL files are exact copies from upstream's `backend/storage/migrations`.
Keep their contents and names unchanged after recording them in `schema_migrations`.

On this branch, run `php backend/bin/sync-database.php` from the repository root.
Its compatibility adapter preserves the existing local profile schema before and
after running the upstream migration runner. The runner is adapted only for this
directory, explicit DB_NAME overrides, and the PHP 8.5 PDO constant.

Local migrations remain in the sibling `migrations` directory and are not replayed
by this runner. Future upstream changes require a new review and a backup test.
