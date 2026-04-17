<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\MonthlyFeeController;
use App\Controllers\PaymentController;
use App\Controllers\ReceiptController;
use App\Controllers\SchoolController;
use App\Controllers\StudentController;
use App\Controllers\SuperAdminController;
use App\Controllers\UserController;
use App\Core\Request;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;

Router::add('POST', '/api/login', [new AuthController(), 'login']);

Router::add('GET', '/api/students', [new StudentController(), 'index'], [AuthMiddleware::class]);
Router::add('POST', '/api/students', [new StudentController(), 'store'], [AuthMiddleware::class]);
Router::add('GET', '/api/parents/summary', [new StudentController(), 'parentSummary'], [AuthMiddleware::class]);

Router::add('GET', '/api/payments', [new PaymentController(), 'index'], [AuthMiddleware::class]);
Router::add('POST', '/api/payments', [new PaymentController(), 'store'], [AuthMiddleware::class]);

Router::add('GET', '/api/monthly-fees', [new MonthlyFeeController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/dashboard', [new DashboardController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/school/dashboard', [new DashboardController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/super-admin/dashboard', [new SuperAdminController(), 'dashboard'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/school/current', [new SchoolController(), 'current'], [AuthMiddleware::class]);
Router::add('GET', '/api/schools', [new SchoolController(), 'index'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools', [new SchoolController(), 'store'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('GET', '/api/schools/{id}', [new SchoolController(), 'show'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('PUT', '/api/schools/{id}', [new SchoolController(), 'update'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools/{id}/admin', [new SchoolController(), 'createAdmin'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools/logo', [new SchoolController(), 'uploadLogo'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/users', [new UserController(), 'index'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('POST', '/api/users', [new UserController(), 'store'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('PUT', '/api/users/{id}', [new UserController(), 'update'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);

Router::add('GET', '/api/receipts', function (): void {
    $paymentId = (int)($_GET['payment_id'] ?? 0);
    (new ReceiptController())->show($paymentId);
}, [AuthMiddleware::class]);

Router::dispatch(Request::method(), Request::uri());
