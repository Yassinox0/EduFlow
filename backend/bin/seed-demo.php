<?php

declare(strict_types=1);

use App\Core\Database;
use Dotenv\Dotenv;

$backendDirectory = dirname(__DIR__);
$autoloadPath = $backendDirectory . '/vendor/autoload.php';

if (!is_file($autoloadPath)) {
    fwrite(STDERR, "Backend dependencies are missing. Run composer install in backend.\n");
    exit(1);
}

require $autoloadPath;
Dotenv::createImmutable($backendDirectory)->safeLoad();

if (($_ENV['APP_ENV'] ?? 'production') !== 'local') {
    fwrite(STDERR, "Demo data is restricted to APP_ENV=local.\n");
    exit(1);
}

$pdo = Database::connect();

$findId = static function (PDO $pdo, string $sql, array $parameters): int {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($parameters);
    return (int)($stmt->fetchColumn() ?: 0);
};

$academicStartYear = (int)date('n') >= 9 ? (int)date('Y') : (int)date('Y') - 1;
$academicYearName = $academicStartYear . '-' . ($academicStartYear + 1);
$academicStartDate = $academicStartYear . '-09-01';
$academicEndDate = ($academicStartYear + 1) . '-06-30';
$septemberFirst = new DateTimeImmutable($academicStartDate);
$firstMonday = $septemberFirst->modify('monday this week');
if ($firstMonday < $septemberFirst) {
    $firstMonday = $firstMonday->modify('+7 days');
}
$today = new DateTimeImmutable('today');
$weekNumber = max(1, min(53, intdiv(max(0, (int)$firstMonday->diff($today)->format('%r%a')), 7) + 1));
$monthLabel = date('m');
$paymentDate = date('Y-m-d');

try {
    $pdo->beginTransaction();

    $schoolId = $findId(
        $pdo,
        'SELECT id FROM schools WHERE LOWER(name) = "miranda" OR email_domain = "miranda.com" ORDER BY id LIMIT 1',
        []
    );

    if ($schoolId <= 0) {
        $stmt = $pdo->prepare('
            INSERT INTO schools (
                name, code, slug, email_domain, phone, address, city, country,
                primary_color, secondary_color, currency, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "ACTIVE")
        ');
        $stmt->execute([
            'MIRANDA',
            'MIRANDA',
            'miranda',
            'miranda.com',
            '0522000000',
            'Établissement scolaire Miranda',
            'Berrechid',
            'Maroc',
            '#1E3A8A',
            '#15957D',
            'MAD',
        ]);
        $schoolId = (int)$pdo->lastInsertId();
    }

    $pdo->prepare('UPDATE academic_years SET is_current = 0 WHERE school_id = ?')->execute([$schoolId]);
    $yearStmt = $pdo->prepare('
        INSERT INTO academic_years (
            school_id, name, start_date, end_date, is_current, status
        ) VALUES (?, ?, ?, ?, 1, "ACTIVE")
        ON DUPLICATE KEY UPDATE
            start_date = VALUES(start_date),
            end_date = VALUES(end_date),
            is_current = 1,
            status = "ACTIVE"
    ');
    $yearStmt->execute([$schoolId, $academicYearName, $academicStartDate, $academicEndDate]);
    $academicYearId = $findId(
        $pdo,
        'SELECT id FROM academic_years WHERE school_id = ? AND name = ? LIMIT 1',
        [$schoolId, $academicYearName]
    );
    $pdo->prepare('
        UPDATE academic_years
        SET status = "CLOSED"
        WHERE school_id = ? AND id <> ? AND status = "ACTIVE"
    ')->execute([$schoolId, $academicYearId]);

    $periodStmt = $pdo->prepare('
        INSERT INTO grading_periods (
            school_id, academic_year_id, code, name, start_date, end_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")
        ON DUPLICATE KEY UPDATE name = VALUES(name), start_date = VALUES(start_date),
            end_date = VALUES(end_date), status = "ACTIVE"
    ');
    $semesterBreak = (new DateTimeImmutable($academicStartDate))->modify('+6 months');
    $periodStmt->execute([$schoolId, $academicYearId, 'SEMESTER_1', 'Semestre 1', $academicStartDate, $semesterBreak->modify('-1 day')->format('Y-m-d')]);
    $periodStmt->execute([$schoolId, $academicYearId, 'SEMESTER_2', 'Semestre 2', $semesterBreak->format('Y-m-d'), $academicEndDate]);

    $ensureClass = static function (
        PDO $pdo,
        int $schoolId,
        string $name,
        string $code,
        string $levelName,
        string $groupName,
        string $schoolYear,
        int $sortOrder
    ) use ($findId): int {
        $stmt = $pdo->prepare('
            INSERT INTO class_levels (
                school_id, name, code, level_name, group_name, school_year, sort_order, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, "ACTIVE")
            ON DUPLICATE KEY UPDATE
                code = VALUES(code),
                level_name = VALUES(level_name),
                group_name = VALUES(group_name),
                school_year = VALUES(school_year),
                sort_order = VALUES(sort_order),
                status = "ACTIVE"
        ');
        $stmt->execute([$schoolId, $name, $code, $levelName, $groupName, $schoolYear, $sortOrder]);
        return $findId($pdo, 'SELECT id FROM class_levels WHERE school_id = ? AND name = ? LIMIT 1', [$schoolId, $name]);
    };

    $class6Id = $ensureClass($pdo, $schoolId, '6eme', '6A', '6ème', 'A', $academicYearName, 1);
    $class5Id = $ensureClass($pdo, $schoolId, '5eme B', '5B', '5ème', 'B', $academicYearName, 2);

    $ensureUser = static function (
        PDO $pdo,
        int $schoolId,
        string $firstName,
        string $lastName,
        string $email,
        string $password,
        string $role,
        ?string $gender,
        string $phone
    ) use ($findId): int {
        $stmt = $pdo->prepare('
            INSERT INTO users (
                school_id, first_name, last_name, email, password, role, status, gender, phone, must_change_password
            ) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE", ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                school_id = VALUES(school_id),
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                password = VALUES(password),
                role = VALUES(role),
                status = "ACTIVE",
                gender = VALUES(gender),
                phone = VALUES(phone),
                must_change_password = VALUES(must_change_password)
        ');
        $stmt->execute([
            $schoolId,
            $firstName,
            $lastName,
            $email,
            password_hash($password, PASSWORD_DEFAULT),
            $role,
            $gender,
            $phone,
            $role === 'professeur' ? 1 : 0,
        ]);
        return $findId($pdo, 'SELECT id FROM users WHERE email = ? LIMIT 1', [$email]);
    };

    $ensureUser($pdo, $schoolId, 'Yassine', 'Benmansour', 'yassine.benmansour@miranda.com', 'admin123', 'admin', 'MALE', '0600000001');
    $ensureUser($pdo, $schoolId, 'Salma', 'Rahib', 'salma@miranda.com', 'user123', 'user', 'FEMALE', '0600000002');
    $yasmineId = $ensureUser($pdo, $schoolId, 'Yasmine', 'Benmansour', 'yasmine.benmansour@miranda.com', 'Prof@123', 'professeur', 'FEMALE', '0600000011');
    $yahiaId = $ensureUser($pdo, $schoolId, 'Yahia', 'Benmansour', 'yahia.benmansour@miranda.com', 'Prof@123', 'professeur', 'MALE', '0600000012');

    $pdo->prepare('
        UPDATE users
        SET role = "user", status = "INACTIVE"
        WHERE school_id = ? AND email = "aya.rahib@miranda.com"
    ')->execute([$schoolId]);

    $ensureParent = static function (
        PDO $pdo,
        int $schoolId,
        string $firstName,
        string $lastName,
        string $phone,
        string $email
    ) use ($findId): int {
        $id = $findId($pdo, 'SELECT id FROM parents WHERE school_id = ? AND phone = ? LIMIT 1', [$schoolId, $phone]);
        if ($id > 0) {
            $pdo->prepare('
                UPDATE parents SET first_name = ?, last_name = ?, email = ? WHERE id = ? AND school_id = ?
            ')->execute([$firstName, $lastName, $email, $id, $schoolId]);
            return $id;
        }

        $stmt = $pdo->prepare('
            INSERT INTO parents (school_id, first_name, last_name, phone, email)
            VALUES (?, ?, ?, ?, ?)
        ');
        $stmt->execute([$schoolId, $firstName, $lastName, $phone, $email]);
        return (int)$pdo->lastInsertId();
    };

    $nadiaId = $ensureParent($pdo, $schoolId, 'Nadia', 'El Fassi', '0600000101', 'nadia.elfassi@example.test');
    $omarId = $ensureParent($pdo, $schoolId, 'Omar', 'Alaoui', '0600000102', 'omar.alaoui@example.test');

    $ensureStudent = static function (
        PDO $pdo,
        int $schoolId,
        int $parentId,
        string $firstName,
        string $lastName,
        string $birthDate,
        string $gender,
        int $classId,
        string $levelName,
        string $className,
        string $parentName,
        string $phone,
        string $address,
        float $monthlyAmount,
        float $discount,
        string $schoolYear
    ) use ($findId): int {
        $id = $findId(
            $pdo,
            'SELECT id FROM students WHERE school_id = ? AND LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) ORDER BY id LIMIT 1',
            [$schoolId, $firstName, $lastName]
        );
        $values = [
            $parentId, $firstName, $lastName, $birthDate, $gender, $levelName, $className,
            $classId, $parentName, $phone, $address, $monthlyAmount, $discount, $schoolYear,
        ];

        if ($id > 0) {
            $stmt = $pdo->prepare('
                UPDATE students
                SET parent_id = ?, first_name = ?, last_name = ?, date_of_birth = ?, gender = ?,
                    class_level = ?, class_name = ?, class_level_id = ?, parent_name = ?, phone = ?,
                    address = ?, monthly_amount = ?, discount_percent = ?, school_year = ?, status = "ACTIVE"
                WHERE id = ? AND school_id = ?
            ');
            $stmt->execute([...$values, $id, $schoolId]);
            return $id;
        }

        $stmt = $pdo->prepare('
            INSERT INTO students (
                school_id, parent_id, first_name, last_name, date_of_birth, gender,
                class_level, class_name, class_level_id, parent_name, phone, address,
                monthly_amount, discount_percent, school_year, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "ACTIVE")
        ');
        $stmt->execute([$schoolId, ...$values]);
        return (int)$pdo->lastInsertId();
    };

    $ayaId = $ensureStudent($pdo, $schoolId, $nadiaId, 'Aya', 'Rahib', '2013-02-14', 'FEMALE', $class6Id, '6ème', '6ème A', 'Nadia El Fassi', '0600000201', 'Berrechid', 1200, 0, $academicYearName);
    $jihadId = $ensureStudent($pdo, $schoolId, $nadiaId, 'Jihad', 'Rahib', '2013-08-21', 'MALE', $class6Id, '6ème', '6ème A', 'Nadia El Fassi', '0600000202', 'Berrechid', 1200, 0, $academicYearName);
    $sultanId = $ensureStudent($pdo, $schoolId, $nadiaId, 'Sultan', 'Rahib', '2014-01-09', 'MALE', $class6Id, '6ème', '6ème A', 'Nadia El Fassi', '0600000203', 'Berrechid', 1200, 10, $academicYearName);
    $mohamedId = $ensureStudent($pdo, $schoolId, $omarId, 'Mohamed', 'Benmansour', '2015-05-18', 'MALE', $class5Id, '5ème', '5ème B', 'Omar Alaoui', '0600000204', 'Berrechid', 1100, 0, $academicYearName);

    $enrollStmt = $pdo->prepare('
        INSERT INTO enrollments (
            school_id, academic_year_id, student_id, class_level_id, enrollment_date, status
        ) VALUES (?, ?, ?, ?, ?, "ACTIVE")
        ON DUPLICATE KEY UPDATE
            class_level_id = VALUES(class_level_id),
            enrollment_date = VALUES(enrollment_date),
            status = "ACTIVE"
    ');
    foreach ([[$ayaId, $class6Id], [$jihadId, $class6Id], [$sultanId, $class6Id], [$mohamedId, $class5Id]] as [$studentId, $classId]) {
        $enrollStmt->execute([$schoolId, $academicYearId, $studentId, $classId, $academicStartDate]);
    }

    $frenchId = $findId($pdo, 'SELECT id FROM subjects WHERE code = "FR" LIMIT 1', []);
    $arabicId = $findId($pdo, 'SELECT id FROM subjects WHERE code = "AR" LIMIT 1', []);
    if ($frenchId <= 0 || $arabicId <= 0) {
        throw new RuntimeException('French and Arabic reference subjects are required.');
    }

    $subjectClassStmt = $pdo->prepare('
        INSERT INTO subject_class_levels (subject_id, class_level_id, weekly_hours)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE weekly_hours = VALUES(weekly_hours)
    ');
    foreach ([[$frenchId, $class6Id, 5], [$arabicId, $class6Id, 5], [$arabicId, $class5Id, 4]] as $subjectClass) {
        $subjectClassStmt->execute($subjectClass);
    }

    $assignmentStmt = $pdo->prepare('
        INSERT INTO teacher_assignments (
            school_id, academic_year_id, teacher_id, subject_id, class_level_id, weekly_hours, status
        ) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")
        ON DUPLICATE KEY UPDATE weekly_hours = VALUES(weekly_hours), status = "ACTIVE"
    ');
    foreach ([[$yasmineId, $frenchId, $class6Id, 5], [$yahiaId, $arabicId, $class6Id, 5], [$yahiaId, $arabicId, $class5Id, 4]] as [$teacherId, $subjectId, $classId, $hours]) {
        $assignmentStmt->execute([$schoolId, $academicYearId, $teacherId, $subjectId, $classId, $hours]);
        $pdo->prepare('INSERT IGNORE INTO teacher_class_levels (teacher_id, class_level_id) VALUES (?, ?)')->execute([$teacherId, $classId]);
        $pdo->prepare('INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)')->execute([$teacherId, $subjectId]);
    }

    $semesterOneId = $findId(
        $pdo,
        'SELECT id FROM grading_periods WHERE school_id = ? AND academic_year_id = ? AND code = "SEMESTER_1" LIMIT 1',
        [$schoolId, $academicYearId]
    );
    $frenchAssignmentId = $findId(
        $pdo,
        'SELECT id FROM teacher_assignments WHERE academic_year_id = ? AND teacher_id = ? AND subject_id = ? AND class_level_id = ? LIMIT 1',
        [$academicYearId, $yasmineId, $frenchId, $class6Id]
    );
    if ($semesterOneId > 0 && $frenchAssignmentId > 0) {
        $assessmentId = $findId(
            $pdo,
            'SELECT id FROM assessments WHERE teacher_assignment_id = ? AND grading_period_id = ? AND title = ? LIMIT 1',
            [$frenchAssignmentId, $semesterOneId, 'Compréhension écrite 1']
        );
        if ($assessmentId <= 0) {
            $stmt = $pdo->prepare('
                INSERT INTO assessments (
                    school_id, teacher_assignment_id, grading_period_id, title, assessment_type,
                    assessment_date, max_score, coefficient, status, created_by, published_at
                ) VALUES (?, ?, ?, ?, "CONTROL", ?, 20, 1, "PUBLISHED", ?, NOW())
            ');
            $stmt->execute([$schoolId, $frenchAssignmentId, $semesterOneId, 'Compréhension écrite 1', $academicStartDate, $yasmineId]);
            $assessmentId = (int)$pdo->lastInsertId();
        }
        $gradeStmt = $pdo->prepare('
            INSERT INTO student_grades (
                school_id, assessment_id, enrollment_id, score, attendance_status, remark, updated_by
            )
            SELECT ?, ?, e.id, ?, ?, ?, ? FROM enrollments e
            WHERE e.school_id = ? AND e.academic_year_id = ? AND e.student_id = ?
            ON DUPLICATE KEY UPDATE score = VALUES(score), attendance_status = VALUES(attendance_status),
                remark = VALUES(remark), updated_by = VALUES(updated_by)
        ');
        foreach ([
            [$ayaId, 17.5, 'PRESENT', 'Très bon travail'],
            [$jihadId, 14.0, 'PRESENT', 'En progrès'],
            [$sultanId, null, 'EXCUSED', 'Absence justifiée'],
        ] as [$studentId, $score, $attendance, $remark]) {
            $gradeStmt->execute([$schoolId, $assessmentId, $score, $attendance, $remark, $yasmineId, $schoolId, $academicYearId, $studentId]);
        }
    }

    $methodIds = [];
    foreach (['CASH', 'CARD'] as $methodCode) {
        $methodIds[$methodCode] = $findId($pdo, 'SELECT id FROM payment_methods WHERE code = ? LIMIT 1', [$methodCode]);
    }

    $ensureFee = static function (
        PDO $pdo,
        int $schoolId,
        int $studentId,
        string $month,
        int $year,
        float $total,
        float $paid
    ) use ($findId): int {
        $id = $findId(
            $pdo,
            'SELECT id FROM monthly_fees WHERE school_id = ? AND student_id = ? AND month_label = ? AND year_value = ? ORDER BY id LIMIT 1',
            [$schoolId, $studentId, $month, $year]
        );
        $remaining = max(0, $total - $paid);
        $status = $remaining <= 0 ? 'PAID' : ($paid > 0 ? 'PARTIAL' : 'UNPAID');

        if ($id > 0) {
            $pdo->prepare('
                UPDATE monthly_fees
                SET total_amount = ?, amount_paid = ?, remaining_amount = ?, status = ?
                WHERE id = ? AND school_id = ?
            ')->execute([$total, $paid, $remaining, $status, $id, $schoolId]);
            return $id;
        }

        $stmt = $pdo->prepare('
            INSERT INTO monthly_fees (
                school_id, student_id, month_label, year_value,
                total_amount, amount_paid, remaining_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$schoolId, $studentId, $month, $year, $total, $paid, $remaining, $status]);
        return (int)$pdo->lastInsertId();
    };

    $feeCases = [
        [$ayaId, 1200.0, 1200.0, 'CASH'],
        [$jihadId, 1200.0, 600.0, 'CARD'],
        [$sultanId, 1080.0, 0.0, null],
        [$mohamedId, 1100.0, 1100.0, 'CASH'],
    ];
    foreach ($feeCases as [$studentId, $total, $paid, $methodCode]) {
        $feeId = $ensureFee($pdo, $schoolId, $studentId, $monthLabel, $academicStartYear, $total, $paid);
        if ($paid <= 0 || $methodCode === null) {
            continue;
        }

        $existingPaymentId = $findId(
            $pdo,
            'SELECT id FROM payments WHERE school_id = ? AND monthly_fee_id = ? AND amount_paid = ? AND payment_date = ? LIMIT 1',
            [$schoolId, $feeId, $paid, $paymentDate]
        );
        if ($existingPaymentId <= 0) {
            $pdo->prepare('
                INSERT INTO payments (
                    school_id, student_id, monthly_fee_id, amount_paid,
                    payment_date, payment_method_id, payment_method
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ')->execute([$schoolId, $studentId, $feeId, $paid, $paymentDate, $methodIds[$methodCode], $methodCode]);
        }
    }

    $ensureSchedule = static function (
        PDO $pdo,
        int $schoolId,
        int $classId,
        int $subjectId,
        string $subjectName,
        int $teacherId,
        string $teacherName,
        int $year,
        int $week,
        string $day,
        int $dayOrder,
        string $start,
        string $end
    ) use ($findId): void {
        $id = $findId(
            $pdo,
            'SELECT id FROM schedules WHERE school_id = ? AND class_level_id = ? AND subject_id = ? AND teacher_id = ? AND year_value = ? AND week_number = ? AND day_of_week = ? AND start_time = ? LIMIT 1',
            [$schoolId, $classId, $subjectId, $teacherId, $year, $week, $day, $start]
        );
        if ($id > 0) {
            $pdo->prepare('
                UPDATE schedules
                SET subject = ?, teacher_name = ?, end_time = ?, status = "ACTIVE"
                WHERE id = ? AND school_id = ?
            ')->execute([$subjectName, $teacherName, $end, $id, $schoolId]);
            return;
        }

        $pdo->prepare('
            INSERT INTO schedules (
                school_id, class_level_id, subject_id, subject, teacher_id, teacher_name,
                room, is_external, schedule_type, year_value, week_number,
                day_of_week, day_order, start_time, end_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, "eduflow_course", ?, ?, ?, ?, ?, ?, "ACTIVE")
        ')->execute([
            $schoolId, $classId, $subjectId, $subjectName, $teacherId, $teacherName,
            'Salle 1', $year, $week, $day, $dayOrder, $start, $end,
        ]);
    };

    $scheduleCases = [
        [$class6Id, $frenchId, 'Français', $yasmineId, 'Yasmine Benmansour', 'MONDAY', 1, '08:00:00', '09:00:00'],
        [$class6Id, $arabicId, 'Arabe', $yahiaId, 'Yahia Benmansour', 'MONDAY', 1, '09:00:00', '10:00:00'],
        [$class6Id, $frenchId, 'Français', $yasmineId, 'Yasmine Benmansour', 'WEDNESDAY', 3, '10:00:00', '11:00:00'],
        [$class5Id, $arabicId, 'Arabe', $yahiaId, 'Yahia Benmansour', 'THURSDAY', 4, '08:00:00', '09:00:00'],
    ];
    foreach ($scheduleCases as [$classId, $subjectId, $subjectName, $teacherId, $teacherName, $day, $dayOrder, $start, $end]) {
        $ensureSchedule(
            $pdo,
            $schoolId,
            $classId,
            $subjectId,
            $subjectName,
            $teacherId,
            $teacherName,
            $academicStartYear,
            $weekNumber,
            $day,
            $dayOrder,
            $start,
            $end
        );
    }

    $pdo->commit();

    echo "Miranda demo data is ready.\n";
    echo "Academic year: {$academicYearName}; schedule week: {$weekNumber}.\n";
    echo "Admin: yassine.benmansour@miranda.com / admin123\n";
    echo "Finance: salma@miranda.com / user123\n";
    echo "French professor: yasmine.benmansour@miranda.com / Prof@123\n";
    echo "Arabic professor: yahia.benmansour@miranda.com / Prof@123\n";
} catch (Throwable $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Demo seed failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
