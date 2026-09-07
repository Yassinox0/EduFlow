<?php

declare(strict_types=1);

/**
 * Backwards-compatible database synchronization command.
 *
 * OneCore's versioned migrations are authoritative; delegating to the shared
 * runner prevents this helper from maintaining a second migration inventory.
 */
$runner = __DIR__ . '/migrate-upstream.php';
$arguments = array_slice($argv, 1);
$command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($runner);
foreach ($arguments as $argument) {
    $command .= ' ' . escapeshellarg($argument);
}

passthru($command, $exitCode);
exit($exitCode);
