<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Services\AccountService;

class AccountController
{
    public function profile(): void
    {
        $result = (new AccountService())->profile();
        $this->respond($result);
    }

    public function changePassword(): void
    {
        $result = (new AccountService())->changePassword(Request::json());
        $this->respond($result);
    }

    public function uploadPhoto(): void
    {
        if (!isset($_FILES['photo']) || !is_uploaded_file($_FILES['photo']['tmp_name'] ?? '')) {
            Response::json(['message' => 'Profile photo is required'], 422);
        }
        $file = $_FILES['photo'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || (int)($file['size'] ?? 0) > 3 * 1024 * 1024) {
            Response::json(['message' => 'Profile photo upload failed or exceeds 3 MB'], 422);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            Response::json(['message' => 'Profile photo must be JPG, PNG or WEBP'], 422);
        }

        $service = new AccountService();
        $user = $service->photoStorageContext();
        if (isset($user['error']) || (int)$user['school_id'] <= 0) {
            Response::json(['message' => $user['error'] ?? 'School account required'], 422);
        }
        $directory = sprintf('%s/../../public/uploads/teachers/school-%d/teacher-%d', __DIR__, $user['school_id'], $user['id']);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            Response::json(['message' => 'Profile photo directory is unavailable'], 500);
        }
        $name = trim((string)$user['first_name'] . ' ' . (string)$user['last_name']);
        $name = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
        $slug = trim((string)preg_replace('/[^\p{L}\p{N}]+/u', '-', $name), '-') ?: 'teacher-' . $user['id'];
        $filename = $slug . '.jpg';
        $absolute = $directory . '/' . $filename;
        $relative = sprintf('uploads/teachers/school-%d/teacher-%d/%s', $user['school_id'], $user['id'], $filename);

        if (!$this->saveAsJpeg((string)$file['tmp_name'], (string)$mime, $absolute)) {
            Response::json(['message' => 'Profile photo could not be converted to JPG'], 500);
        }
        $this->respond($service->updatePhoto($relative));
    }

    private function saveAsJpeg(string $source, string $mime, string $destination): bool
    {
        if ($mime === 'image/jpeg') {
            return move_uploaded_file($source, $destination);
        }
        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
            return false;
        }
        $contents = @file_get_contents($source);
        $image = $contents !== false ? @imagecreatefromstring($contents) : false;
        if (!$image) return false;
        $result = imagejpeg($image, $destination, 88);
        imagedestroy($image);
        return $result;
    }

    private function respond(array $result): void
    {
        if (isset($result['error'])) {
            Response::json(['message' => $result['error']], 422);
        }
        Response::json($result);
    }
}
