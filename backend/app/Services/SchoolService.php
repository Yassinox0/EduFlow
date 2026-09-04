<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use PDOException;

class SchoolService
{
    public function listAll(): array
    {
        $pdo = Database::connect();
        $stmt = $pdo->query('SELECT id, name, code, slug, email_domain, logo_path, phone, phone_secondary, email, website, administrative_info, address, city, country, primary_color, secondary_color, currency, status, created_at FROM schools ORDER BY id DESC');
        return $stmt->fetchAll();
    }

    public function getById(int $schoolId): array|false
    {
        $pdo = Database::connect();
        $stmt = $pdo->prepare('SELECT id, name, code, slug, email_domain, logo_path, phone, phone_secondary, email, website, administrative_info, address, city, country, primary_color, secondary_color, currency, status, created_at FROM schools WHERE id = ? LIMIT 1');
        $stmt->execute([$schoolId]);
        $school = $stmt->fetch();
        return $school ? $this->withLogoDataUrl($school) : false;
    }

    public function create(array $data): array
    {
        $name = trim((string)($data['name'] ?? ''));
        $code = strtoupper(trim((string)($data['code'] ?? '')));
        $logoPath = trim((string)($data['logo_path'] ?? ''));

        if ($name === '' || $code === '') {
            return ['error' => 'School name and code are required'];
        }

        $slug = $this->slugify((string)($data['slug'] ?? $name));
        if ($slug === '') {
            return ['error' => 'Invalid school slug'];
        }

        $emailDomain = strtolower(trim((string)($data['email_domain'] ?? ($slug . '.com'))));
        if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $emailDomain)) {
            return ['error' => 'Invalid email domain'];
        }

        $status = strtoupper(trim((string)($data['status'] ?? 'ACTIVE')));
        if (!in_array($status, ['ACTIVE', 'INACTIVE'], true)) {
            return ['error' => 'Invalid school status'];
        }

        $primaryColor = trim((string)($data['primary_color'] ?? '#1E3A8A'));
        $secondaryColor = trim((string)($data['secondary_color'] ?? '#22C55E'));
        $currency = strtoupper(trim((string)($data['currency'] ?? 'MAD')));

        try {
            $pdo = Database::connect();
            $stmt = $pdo->prepare('INSERT INTO schools (name, code, slug, email_domain, logo_path, phone, address, city, country, primary_color, secondary_color, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $name,
                $code,
                $slug,
                $emailDomain,
                $logoPath !== '' ? $logoPath : null,
                $this->nullable($data['phone'] ?? null),
                $this->nullable($data['address'] ?? null),
                $this->nullable($data['city'] ?? null),
                $this->nullable($data['country'] ?? null),
                $primaryColor,
                $secondaryColor,
                $currency,
                $status,
            ]);

            $schoolId = (int)$pdo->lastInsertId();
            $school = $this->getById($schoolId);
            return $school ?: ['id' => $schoolId, 'message' => 'School created successfully'];
        } catch (PDOException $e) {
            if ((int)$e->getCode() === 23000) {
                return ['error' => 'School code, slug, or email domain already exists'];
            }
            return ['error' => 'School creation failed'];
        }
    }

    public function update(int $schoolId, array $data): array
    {
        $school = $this->getById($schoolId);
        if (!$school) {
            return ['error' => 'School not found'];
        }

        $name = trim((string)($data['name'] ?? $school['name']));
        $code = strtoupper(trim((string)($data['code'] ?? $school['code'])));
        $slug = $this->slugify((string)($data['slug'] ?? $school['slug']));
        $emailDomain = strtolower(trim((string)($data['email_domain'] ?? $school['email_domain'])));
        $status = strtoupper(trim((string)($data['status'] ?? $school['status'])));

        if ($name === '' || $code === '' || $slug === '') {
            return ['error' => 'School name, code, and slug are required'];
        }
        if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $emailDomain)) {
            return ['error' => 'Invalid email domain'];
        }
        if (!in_array($status, ['ACTIVE', 'INACTIVE'], true)) {
            return ['error' => 'Invalid school status'];
        }
        $email = $this->nullable($data['email'] ?? $school['email']);
        $phone = $this->cleanPhone($data['phone'] ?? $school['phone']);
        $phoneSecondary = $this->cleanPhone($data['phone_secondary'] ?? $school['phone_secondary'] ?? null);
        $website = $this->nullable($data['website'] ?? $school['website'] ?? null);
        $administrativeInfo = $this->nullable($data['administrative_info'] ?? $school['administrative_info'] ?? null);
        $country = $this->nullable($data['country'] ?? $school['country']) ?? 'Maroc';
        $currency = strtoupper(trim((string)($data['currency'] ?? $school['currency'] ?? 'MAD')));
        $primaryColor = strtoupper(trim((string)($data['primary_color'] ?? $school['primary_color'] ?? '#0F4AA3')));
        $secondaryColor = strtoupper(trim((string)($data['secondary_color'] ?? $school['secondary_color'] ?? '#15957D')));
        if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) return ['error' => 'Adresse e-mail invalide'];
        if (strlen($country) > 100) return ['error' => 'Pays invalide'];
        if (($phone !== null && !preg_match('/^[0-9+(). -]{3,30}$/', $phone)) || ($phoneSecondary !== null && !preg_match('/^[0-9+(). -]{3,30}$/', $phoneSecondary))) return ['error' => 'Téléphone invalide'];
        if ($website !== null && !filter_var($website, FILTER_VALIDATE_URL)) return ['error' => 'Site web invalide'];
        if ($administrativeInfo !== null && strlen($administrativeInfo) > 500) return ['error' => 'Information administrative invalide'];
        if (!in_array($currency, ['MAD', 'EUR', 'USD'], true)) return ['error' => 'Devise invalide'];
        if (!preg_match('/^#[0-9A-F]{6}$/', $primaryColor) || !preg_match('/^#[0-9A-F]{6}$/', $secondaryColor)) return ['error' => 'Les couleurs doivent être au format #RRGGBB'];

        try {
            $pdo = Database::connect();
            $stmt = $pdo->prepare('UPDATE schools SET name = ?, code = ?, slug = ?, email_domain = ?, logo_path = ?, phone = ?, phone_secondary = ?, email = ?, website = ?, administrative_info = ?, address = ?, city = ?, country = ?, primary_color = ?, secondary_color = ?, currency = ?, status = ? WHERE id = ?');
            $stmt->execute([
                $name,
                $code,
                $slug,
                $emailDomain,
                $data['logo_path'] ?? $school['logo_path'],
                $phone,
                $phoneSecondary,
                $email,
                $website,
                $administrativeInfo,
                $this->nullable($data['address'] ?? $school['address']),
                $this->nullable($data['city'] ?? $school['city']),
                $country,
                $primaryColor,
                $secondaryColor,
                $currency,
                $status,
                $schoolId,
            ]);

            $updated = $this->getById($schoolId);
            return $updated ?: ['id' => $schoolId, 'message' => 'School updated'];
        } catch (PDOException $e) {
            if ((int)$e->getCode() === 23000) {
                return ['error' => 'School code, slug, or email domain already exists'];
            }
            return ['error' => 'School update failed'];
        }
    }

    public function createSchoolAdmin(int $schoolId, array $data): array
    {
        $school = $this->getById($schoolId);
        if (!$school) {
            return ['error' => 'School not found'];
        }

        $firstName = trim((string)($data['first_name'] ?? ''));
        $lastName = trim((string)($data['last_name'] ?? ''));
        $password = (string)($data['password'] ?? '');
        $status = strtoupper(trim((string)($data['status'] ?? 'ACTIVE')));

        if ($firstName === '' || $lastName === '' || $password === '') {
            return ['error' => 'first_name, last_name, and password are required'];
        }

        if (!in_array($status, ['ACTIVE', 'INACTIVE'], true)) {
            return ['error' => 'Invalid user status'];
        }

        $localPart = strtolower(trim((string)($data['email_local_part'] ?? '')));
        if ($localPart === '') {
            $localPart = $this->slugify($firstName . '.' . $lastName);
        }

        $email = $this->generateUniqueEmail($localPart, $school['email_domain']);

        try {
            $pdo = Database::connect();
            $stmt = $pdo->prepare('INSERT INTO users (school_id, first_name, last_name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([
                $schoolId,
                $firstName,
                $lastName,
                $email,
                password_hash($password, PASSWORD_DEFAULT),
                'admin',
                $status,
            ]);

            return [
                'id' => (int)$pdo->lastInsertId(),
                'school_id' => $schoolId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'role' => 'admin',
                'status' => $status,
                'message' => 'School admin created successfully',
            ];
        } catch (PDOException $e) {
            return ['error' => 'Failed to create school admin'];
        }
    }

    public function getCurrent(): array
    {
        $authUser = Request::get('auth_user', []);
        $role = (string)($authUser['role'] ?? '');
        $schoolId = isset($authUser['school_id']) ? (int)$authUser['school_id'] : null;

        if ($role === 'super_admin') {
            $schools = $this->listAll();
            $school = $schools[0] ?? [
                'id' => null,
                'name' => null,
                'code' => null,
                'slug' => null,
                'email_domain' => null,
                'logo_path' => null,
                'status' => null,
            ];
            return $this->withLogoDataUrl($school);
        }

        $school = $schoolId ? $this->getById($schoolId) : false;
        return $this->withLogoDataUrl($school ?: [
            'id' => null,
            'name' => null,
            'code' => null,
            'slug' => null,
            'email_domain' => null,
            'logo_path' => null,
            'status' => null,
        ]);
    }

    public function getActiveAcademicYear(): array
    {
        $schoolId = (int)(Request::get('auth_user', [])['school_id'] ?? 0);
        if (!$schoolId) return ['active_academic_year_id' => null, 'active_academic_year' => null];
        $pdo = Database::connect();
        $setting = $pdo->prepare('SELECT setting_value FROM school_settings WHERE school_id = ? AND setting_key = "active_academic_year_id"');
        $setting->execute([$schoolId]); $id = (int)($setting->fetchColumn() ?: 0);
        $year = null;
        if ($id) { $stmt = $pdo->prepare('SELECT id,label,starts_on,ends_on,status FROM academic_years WHERE id = ? AND school_id = ?'); $stmt->execute([$id, $schoolId]); $year = $stmt->fetch() ?: null; }
        return ['active_academic_year_id' => $year ? (int)$year['id'] : null, 'active_academic_year' => $year];
    }

    public function updateActiveAcademicYear(int $yearId): array
    {
        $schoolId = (int)(Request::get('auth_user', [])['school_id'] ?? 0);
        if (!$schoolId || $yearId <= 0) return ['error' => 'Année scolaire invalide'];
        $pdo = Database::connect(); $year = $pdo->prepare('SELECT id,label FROM academic_years WHERE id = ? AND school_id = ?'); $year->execute([$yearId, $schoolId]);
        if (!$year->fetch()) return ['error' => 'Cette année scolaire n’appartient pas à votre établissement'];
        $user = Request::get('auth_user', []);
        $stmt = $pdo->prepare('INSERT INTO school_settings (school_id,setting_key,setting_value,updated_by) VALUES (?,"active_academic_year_id",?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by)');
        $stmt->execute([$schoolId, (string)$yearId, (int)($user['id'] ?? 0) ?: null]);
        return $this->getActiveAcademicYear() + ['message' => 'Année scolaire active mise à jour'];
    }

    private function withLogoDataUrl(array $school): array
    {
        $school['logo_data_url'] = null;
        $logoPath = trim((string)($school['logo_path'] ?? ''));
        if ($logoPath === '' || preg_match('/^https?:\/\//i', $logoPath)) {
            return $school;
        }

        $normalized = ltrim(str_replace('\\', '/', $logoPath), '/');
        $absolutePath = realpath(__DIR__ . '/../../public/' . $normalized);
        $publicRoot = realpath(__DIR__ . '/../../public');
        if (!$absolutePath || !$publicRoot || !str_starts_with($absolutePath, $publicRoot) || !is_file($absolutePath)) {
            return $school;
        }

        $mime = mime_content_type($absolutePath) ?: 'image/png';
        if (!str_starts_with($mime, 'image/')) {
            return $school;
        }

        $content = file_get_contents($absolutePath);
        if ($content === false) {
            return $school;
        }

        $school['logo_data_url'] = 'data:' . $mime . ';base64,' . base64_encode($content);
        return $school;
    }

    private function generateUniqueEmail(string $localPart, string $domain): string
    {
        $pdo = Database::connect();

        $base = preg_replace('/[^a-z0-9._-]/', '', strtolower($localPart));
        if ($base === '') {
            $base = 'user';
        }

        $candidate = $base;
        $counter = 0;

        while (true) {
            $email = $candidate . '@' . strtolower($domain);
            $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
            if (!$stmt->fetch()) {
                return $email;
            }
            $counter++;
            $candidate = $base . $counter;
        }
    }

    private function slugify(string $value): string
    {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);
        return trim((string)$value, '-');
    }

    private function nullable(mixed $value): ?string
    {
        $str = trim((string)$value);
        return $str === '' ? null : $str;
    }

    private function cleanPhone(mixed $value): ?string
    {
        $value = $this->nullable($value);
        return $value === null ? null : trim((string) preg_replace('/\s+/', ' ', $value));
    }

    public function uploadCurrentLogo(array $file): array
    {
        $schoolId = (int)(Request::get('auth_user', [])['school_id'] ?? 0);
        if (!$schoolId) return ['error' => 'Établissement introuvable'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)($file['tmp_name'] ?? ''))) return ['error' => 'Fichier logo invalide'];
        if ((int)($file['size'] ?? 0) > 2 * 1024 * 1024) return ['error' => 'Le logo ne doit pas dépasser 2 Mo'];
        $tmp = (string)$file['tmp_name']; $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);
        $types = ['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'];
        if (!isset($types[$mime]) || @getimagesize($tmp) === false) return ['error' => 'Format de logo non autorisé'];
        $dir = __DIR__ . '/../../storage/uploads/schools/' . $schoolId;
        if (!is_dir($dir) && !mkdir($dir, 0750, true)) return ['error' => 'Stockage du logo impossible'];
        $name = bin2hex(random_bytes(16)) . '.' . $types[$mime]; $path = $dir . '/' . $name; $relative = 'storage/uploads/schools/' . $schoolId . '/' . $name;
        if (!move_uploaded_file($tmp, $path)) return ['error' => 'Enregistrement du logo impossible'];
        $school = $this->getById($schoolId); $old = (string)($school['logo_path'] ?? '');
        try { $stmt=Database::connect()->prepare('UPDATE schools SET logo_path=? WHERE id=?'); $stmt->execute([$relative,$schoolId]); } catch (PDOException) { @unlink($path); return ['error'=>'Mise à jour du logo impossible']; }
        $this->deleteLogoFile($old, $schoolId); return ['logo_path'=>$relative,'mime'=>$mime];
    }
    public function getCurrentLogo(): array { $id=(int)(Request::get('auth_user',[])['school_id']??0);$s=$id?$this->getById($id):false;if(!$s||empty($s['logo_path']))return ['logo'=>null];$file=$this->logoFile((string)$s['logo_path'],$id);if(!$file)return ['logo'=>null];$mime=mime_content_type($file)?:'image/png';return ['logo'=>'data:'.$mime.';base64,'.base64_encode((string)file_get_contents($file)),'mime'=>$mime]; }
    public function deleteCurrentLogo(): array { $id=(int)(Request::get('auth_user',[])['school_id']??0);$s=$id?$this->getById($id):false;if(!$s)return ['error'=>'Établissement introuvable'];$old=(string)($s['logo_path']??'');Database::connect()->prepare('UPDATE schools SET logo_path=NULL WHERE id=?')->execute([$id]);$this->deleteLogoFile($old,$id);return ['message'=>'Logo supprimé']; }
    private function logoFile(string $relative,int $schoolId):?string { $prefix='storage/uploads/schools/'.$schoolId.'/';if(!str_starts_with($relative,$prefix))return null;$file=realpath(__DIR__.'/../../'.$relative);$dir=realpath(__DIR__.'/../../storage/uploads/schools/'.$schoolId);return $file&&$dir&&str_starts_with($file,$dir.'/')&&is_file($file)?$file:null; }
    private function deleteLogoFile(string $relative,int $schoolId):void { $file=$this->logoFile($relative,$schoolId);if($file)@unlink($file); }

    public function delete(int $schoolId): array
    {
        $school = $this->getById($schoolId);
        if (!$school) {
            return ['error' => 'School not found'];
        }

        try {
            $pdo = Database::connect();
            $stmt = $pdo->prepare('DELETE FROM schools WHERE id = ?');
            $stmt->execute([$schoolId]);

            return ['id' => $schoolId, 'message' => 'School deleted successfully'];
        } catch (PDOException) {
            return ['error' => 'School deletion failed'];
        }
    }
}
