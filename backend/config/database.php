<?php
return [
  'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
  'port' => $_ENV['DB_PORT'] ?? '3306',
  'dbname' => $_ENV['DB_NAME'] ?? 'salma_project',
  'username' => $_ENV['DB_USER'] ?? 'root',
  'password' => $_ENV['DB_PASS'] ?? '',
];
