<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\SchoolImportService;
use App\Services\SchoolService;

class SchoolController
{
    public function index(): void
    {
        Response::json((new SchoolService())->listAll());
    }

    public function current(): void
    {
        Response::json((new SchoolService())->getCurrent());
    }

    public function updateCurrent(): void
    {
        $user = Request::get('auth_user', []);
        $schoolId = (int)($user['school_id'] ?? 0);
        if (!$schoolId) Response::json(['message' => 'School not found'], 404);
        $result = (new SchoolService())->update($schoolId, Request::json());
        if (isset($result['error'])) Response::json(['message' => $result['error']], 422);
        Response::json($result);
    }
    public function activeAcademicYear(): void { Response::json((new SchoolService())->getActiveAcademicYear()); }
    public function updateActiveAcademicYear(): void { $r=(new SchoolService())->updateActiveAcademicYear((int)(Request::json()['academic_year_id']??0));if(isset($r['error']))Response::json(['message'=>$r['error']],422);Response::json($r); }

    public function show(): void
    {
        $id = (int)Request::param('id', 0);
        $school = (new SchoolService())->getById($id);

        if (!$school) {
            Response::json(['message' => 'School not found'], 404);
        }

        Response::json($school);
    }

    public function store(): void
    {
        $result = (new SchoolService())->create(Request::json());
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }

        Response::json($result, 201);
    }

    public function update(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new SchoolService())->update($id, Request::json());

        if (isset($result['error'])) {
            $status = $result['error'] === 'School not found' ? 404 : 422;
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result);
    }

    public function delete(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new SchoolService())->delete($id);

        if (isset($result['error'])) {
            $status = $result['error'] === 'School not found' ? 404 : 422;
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result);
    }

    public function createAdmin(): void
    {
        $id = (int)Request::param('id', 0);
        $result = (new SchoolService())->createSchoolAdmin($id, Request::json());

        if (isset($result['error'])) {
            $status = $result['error'] === 'School not found' ? 404 : 422;
            Response::json(['message' => $result['error']], $status);
        }

        Response::json($result, 201);
    }

    public function importData(): void
    {
        $id = (int)Request::param('id', 0);
        if (!isset($_FILES['school_data'])) {
            Response::json(['message' => 'Le fichier de données école est obligatoire.'], 422);
        }

        $result = (new SchoolImportService())->import($id, $_FILES['school_data']);
        if (isset($result['error'])) {
            Response::json([
                'message' => $result['error'],
                'details' => $result['details'] ?? [],
            ], 422);
        }

        Response::json($result, 201);
    }

    public function uploadLogo(): void
    {
        $result=(new SchoolService())->uploadCurrentLogo($_FILES['logo']??[]);if(isset($result['error']))Response::json(['message'=>$result['error']],422);Response::json($result,201);return;
        if (!isset($_FILES['logo'])) {
            Response::json(['message' => 'Logo file is required'], 422);
        }

        $file = $_FILES['logo'];
        $tmpPath = $file['tmp_name'] ?? '';
        $name = $file['name'] ?? '';

        if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
            Response::json(['message' => 'Invalid uploaded file'], 422);
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'svg', 'webp'], true)) {
            Response::json(['message' => 'Unsupported logo format'], 422);
        }

        $fileName = 'school_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $relativePath = 'uploads/schools/' . $fileName;
        $absolutePath = __DIR__ . '/../../public/' . $relativePath;

        if (!move_uploaded_file($tmpPath, $absolutePath)) {
            Response::json(['message' => 'Logo upload failed'], 500);
        }

        Response::json([
            'logo_path' => $relativePath,
            'public_url' => 'http://127.0.0.1:8080/' . $relativePath,
        ], 201);
    }

    public function currentLogo(): void { Response::json((new SchoolService())->getCurrentLogo()); }
    public function deleteCurrentLogo(): void { $result=(new SchoolService())->deleteCurrentLogo();if(isset($result['error']))Response::json(['message'=>$result['error']],404);Response::json($result); }
}
