<?php
return [
  'name' => $_ENV['APP_NAME'] ?? 'Salma Project',
  'env' => $_ENV['APP_ENV'] ?? 'production',
  'debug' => filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL),
  'url' => $_ENV['APP_URL'] ?? 'http://localhost',
  'jwt_ttl' => (int)($_ENV['JWT_TTL'] ?? 86400),
];
