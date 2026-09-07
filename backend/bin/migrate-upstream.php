<?php

declare(strict_types=1);

/**
 * Compatibility entry point for collaborators who previously used this script.
 * The canonical OneCore migration runner and migration directory now live in
 * this repository, so no private copy of upstream migrations is replayed.
 */
$runner = __DIR__ . '/migrate.php';

if (!is_file($runner)) {
    fwrite(STDERR, "Canonical migration runner is unavailable.\n");
    exit(1);
}

$arguments = array_slice($argv, 1);
$command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($runner);
foreach ($arguments as $argument) {
    $command .= ' ' . escapeshellarg($argument);
}

passthru($command, $exitCode);
exit($exitCode);
