<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\AlertController;
use App\Controllers\ClassLevelController;
use App\Controllers\MonthlyFeeController;
use App\Controllers\PaymentController;
use App\Controllers\PaymentMethodController;
use App\Controllers\ReceiptController;
use App\Controllers\SchoolController;
use App\Controllers\ScheduleController;
use App\Controllers\SubjectController;
use App\Controllers\StudentController;
use App\Controllers\PersonnelController;
use App\Controllers\SuperAdminController;
use App\Controllers\TeacherController;
use App\Controllers\UserController;
use App\Controllers\FamilyController;
use App\Controllers\StudentDocumentController;
use App\Controllers\LevelFeeController;
use App\Controllers\AcademicYearController;
use App\Controllers\PermissionController;
use App\Core\Request;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Middleware\PermissionMiddleware;

Router::add('POST', '/api/login', [new AuthController(), 'login']);
Router::add('GET', '/api/me/permissions', [new PermissionController(), 'mine'], [AuthMiddleware::class]);

Router::add('GET', '/api/students', [new StudentController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/personnel/next-number', [new PersonnelController(), 'nextNumber'], [AuthMiddleware::class, new PermissionMiddleware('personnel.view')]);
Router::add('GET', '/api/personnel', [new PersonnelController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('personnel.view')]);
Router::add('POST', '/api/personnel', [new PersonnelController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('personnel.manage')]);
Router::add('GET', '/api/personnel/{id}', [new PersonnelController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('personnel.view')]);
Router::add('PUT', '/api/personnel/{id}', [new PersonnelController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('personnel.manage')]);
Router::add('PATCH', '/api/personnel/{id}/status', [new PersonnelController(), 'status'], [AuthMiddleware::class, new PermissionMiddleware('personnel.manage')]);
Router::add('POST', '/api/students', [new StudentController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/students/matricule-preview', [new StudentController(), 'matriculePreview'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/students/massar-check', [new StudentController(), 'massarCheck'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('POST', '/api/students/photo', [new StudentController(), 'uploadPhoto'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('POST', '/api/students/import', [new StudentController(), 'importClass'], [AuthMiddleware::class, new PermissionMiddleware('students.import')]);
Router::add('GET', '/api/students/{id}/profile', [new StudentController(), 'profile'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('POST', '/api/students/{id}/status', [new StudentController(), 'status'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/students/{id}/status-history', [new StudentController(), 'statusHistory'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/students/{id}', [new StudentController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('PUT', '/api/students/{id}', [new StudentController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('DELETE', '/api/students/{id}', [new StudentController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('GET', '/api/parents/summary', [new StudentController(), 'parentSummary'], [AuthMiddleware::class]);
Router::add('POST', '/api/documents/students/financial', [new StudentDocumentController(), 'generate'], [AuthMiddleware::class, new PermissionMiddleware('student_finance.view')]);
Router::add('GET', '/api/families/candidates', [new FamilyController(), 'candidates'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('POST', '/api/families', [new FamilyController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('GET', '/api/families/{id}', [new FamilyController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('POST', '/api/families/{id}/students', [new FamilyController(), 'attach'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('DELETE', '/api/students/{id}/family', [new FamilyController(), 'detach'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('GET', '/api/students/{id}/guardians', [new FamilyController(), 'guardians'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('POST', '/api/students/{id}/guardians', [new FamilyController(), 'addGuardian'], [AuthMiddleware::class, new PermissionMiddleware('families.manage')]);
Router::add('GET', '/api/class-levels', [new ClassLevelController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('classes.view')]);
Router::add('GET', '/api/academic-years', [new AcademicYearController(), 'index'], [AuthMiddleware::class]);
Router::add('POST', '/api/class-levels', [new ClassLevelController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('classes.manage')]);
Router::add('GET', '/api/class-levels/{id}', [new ClassLevelController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('classes.view')]);
Router::add('GET', '/api/class-levels/{id}/fees', [new LevelFeeController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('students.manage')]);
Router::add('PUT', '/api/class-levels/{id}', [new ClassLevelController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('classes.manage')]);
Router::add('DELETE', '/api/class-levels/{id}', [new ClassLevelController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('classes.manage')]);

Router::add('GET', '/api/subjects', [new SubjectController(), 'index'], [AuthMiddleware::class]);
Router::add('PUT', '/api/subjects/{id}/class-levels/{classLevelId}', [new SubjectController(), 'updateClassLevelHours'], [AuthMiddleware::class, new PermissionMiddleware('classes.manage')]);
Router::add('GET', '/api/teachers', [new TeacherController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('teachers.view')]);
Router::add('POST', '/api/teachers', [new TeacherController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('teachers.manage')]);
Router::add('PUT', '/api/teachers/{id}', [new TeacherController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('teachers.manage')]);
Router::add('DELETE', '/api/teachers/{id}', [new TeacherController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('teachers.manage')]);

Router::add('GET', '/api/schedules', [new ScheduleController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('schedules.view')]);
Router::add('POST', '/api/schedules', [new ScheduleController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('schedules.manage')]);
Router::add('GET', '/api/schedules/{id}', [new ScheduleController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('schedules.view')]);
Router::add('PUT', '/api/schedules/{id}', [new ScheduleController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('schedules.manage')]);
Router::add('DELETE', '/api/schedules/{id}', [new ScheduleController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('schedules.manage')]);

Router::add('GET', '/api/payments', [new PaymentController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('payments.view')]);
Router::add('POST', '/api/payments', [new PaymentController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('payments.create')]);
Router::add('GET', '/api/payments/{id}', [new PaymentController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('payments.view')]);
Router::add('PUT', '/api/payments/{id}', [new PaymentController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('payments.update')]);
Router::add('DELETE', '/api/payments/{id}', [new PaymentController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('payments.delete')]);
Router::add('GET', '/api/receipts/{id}', [new ReceiptController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('payments.export')]);
Router::add('GET', '/api/receipts/{id}/pdf', [new ReceiptController(), 'downloadPdf'], [AuthMiddleware::class, new PermissionMiddleware('payments.export')]);
Router::add('GET', '/api/payment-methods', [new PaymentMethodController(), 'index'], [AuthMiddleware::class]);
Router::add('POST', '/api/payment-methods', [new PaymentMethodController(), 'store'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('GET', '/api/payment-methods/{id}', [new PaymentMethodController(), 'show'], [AuthMiddleware::class]);
Router::add('PUT', '/api/payment-methods/{id}', [new PaymentMethodController(), 'update'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('DELETE', '/api/payment-methods/{id}', [new PaymentMethodController(), 'delete'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/monthly-fees', [new MonthlyFeeController(), 'index'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.view')]);
Router::add('POST', '/api/monthly-fees', [new MonthlyFeeController(), 'store'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.manage')]);
Router::add('GET', '/api/monthly-fees/unpaid', [new MonthlyFeeController(), 'unpaid'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.view')]);
Router::add('GET', '/api/monthly-fees/{id}', [new MonthlyFeeController(), 'show'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.view')]);
Router::add('PUT', '/api/monthly-fees/{id}', [new MonthlyFeeController(), 'update'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.manage')]);
Router::add('DELETE', '/api/monthly-fees/{id}', [new MonthlyFeeController(), 'delete'], [AuthMiddleware::class, new PermissionMiddleware('monthly_fees.manage')]);
Router::add('GET', '/api/dashboard', [new DashboardController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/dashboard/alerts', [new AlertController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/school/dashboard', [new DashboardController(), 'index'], [AuthMiddleware::class]);
Router::add('GET', '/api/super-admin/dashboard', [new SuperAdminController(), 'dashboard'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/school/current', [new SchoolController(), 'current'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);
Router::add('PUT', '/api/school/current', [new SchoolController(), 'updateCurrent'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);
Router::add('GET', '/api/school/current/active-academic-year', [new SchoolController(), 'activeAcademicYear'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);
Router::add('PUT', '/api/school/current/active-academic-year', [new SchoolController(), 'updateActiveAcademicYear'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);
Router::add('GET', '/api/school/current/logo', [new SchoolController(), 'currentLogo'], [AuthMiddleware::class]);
Router::add('POST', '/api/school/current/logo', [new SchoolController(), 'uploadLogo'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);
Router::add('DELETE', '/api/school/current/logo', [new SchoolController(), 'deleteCurrentLogo'], [AuthMiddleware::class, new RoleMiddleware(['admin', 'super_admin'])]);

// School routes - specific routes before generic {id} routes
Router::add('GET', '/api/schools', [new SchoolController(), 'index'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools', [new SchoolController(), 'store'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools/logo', [new SchoolController(), 'uploadLogo'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

// School {id} routes
Router::add('GET', '/api/schools/{id}', [new SchoolController(), 'show'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('PUT', '/api/schools/{id}', [new SchoolController(), 'update'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('DELETE', '/api/schools/{id}', [new SchoolController(), 'delete'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools/{id}/admin', [new SchoolController(), 'createAdmin'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);
Router::add('POST', '/api/schools/{id}/import-data', [new SchoolController(), 'importData'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/users', [new UserController(), 'index'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('POST', '/api/users', [new UserController(), 'store'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('GET', '/api/users/{id}', [new UserController(), 'show'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('PUT', '/api/users/{id}', [new UserController(), 'update'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('DELETE', '/api/users/{id}', [new UserController(), 'delete'], [AuthMiddleware::class, new RoleMiddleware(['super_admin', 'admin'])]);
Router::add('POST', '/api/users/{id}/reset-password', [new UserController(), 'resetPassword'], [AuthMiddleware::class, new RoleMiddleware('super_admin')]);

Router::add('GET', '/api/receipts', function (): void {
    $paymentId = (int)($_GET['payment_id'] ?? 0);
    (new ReceiptController())->show($paymentId);
}, [AuthMiddleware::class, new PermissionMiddleware('payments.export')]);

Router::dispatch(Request::method(), Request::uri());
