<?php

declare(strict_types=1);

namespace App\Core;

class Router
{
    private static array $routes = [];

    public static function add(string $method, string $uri, callable $action, array $middlewares = []): void
    {
        self::$routes[] = [
            'method' => strtoupper($method),
            'uri' => $uri,
            'action' => $action,
            'middlewares' => $middlewares,
        ];
    }

    public static function dispatch(string $method, string $uri): void
    {
        $method = strtoupper($method);
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';

        foreach (self::$routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            $params = self::matchUri($route['uri'], $path);
            if ($params === null) {
                continue;
            }

            Request::set('route_params', $params);

            foreach ($route['middlewares'] as $middleware) {
                if (is_object($middleware)) {
                    $middleware->handle();
                    continue;
                }

                (new $middleware())->handle();
            }

            call_user_func($route['action']);
            return;
        }

        Response::json(['message' => 'Route not found'], 404);
    }

    private static function matchUri(string $routeUri, string $currentPath): ?array
    {
        $pattern = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function ($matches): string {
            return '(?P<' . $matches[1] . '>[^/]+)';
        }, $routeUri);

        $regex = '#^' . $pattern . '$#';

        if (!preg_match($regex, $currentPath, $matches)) {
            return null;
        }

        $params = [];
        foreach ($matches as $key => $value) {
            if (is_string($key)) {
                $params[$key] = $value;
            }
        }

        return $params;
    }
}
