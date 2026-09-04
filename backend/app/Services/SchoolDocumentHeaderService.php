<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;

class SchoolDocumentHeaderService
{
    public function render(int $schoolId): string
    {
        $stmt = Database::connect()->prepare('SELECT name, address, city, phone, phone_secondary, email, website, administrative_info, primary_color, logo_path FROM schools WHERE id = ? LIMIT 1');
        $stmt->execute([$schoolId]);
        $school = $stmt->fetch() ?: [];
        $escape = static fn (mixed $value): string => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
        $contacts = array_filter([$school['address'] ?? null, $school['city'] ?? null, $school['phone'] ?? null, $school['phone_secondary'] ?? null, $school['email'] ?? null, $school['website'] ?? null]);
        $logo = $this->logoDataUrl((string) ($school['logo_path'] ?? ''), $schoolId);
        $logoHtml = $logo ? '<img src="' . $escape($logo) . '" alt="Logo" style="max-width:64px;max-height:64px;object-fit:contain">' : '';
        return '<table style="width:100%;border-bottom:2px solid ' . $escape($school['primary_color'] ?? '#0F4AA3') . ';margin:0 0 18px;padding:0 0 8px"><tr><td style="width:76px;vertical-align:top">' . $logoHtml . '</td><td><strong style="font-size:16px">' . $escape($school['name'] ?? 'Établissement') . '</strong><br><span style="font-size:9px">' . $escape(implode(' · ', $contacts)) . '</span>' . (!empty($school['administrative_info']) ? '<br><span style="font-size:9px">' . $escape($school['administrative_info']) . '</span>' : '') . '</td></tr></table>';
    }

    private function logoDataUrl(string $relativePath, int $schoolId): ?string
    {
        $prefix = 'storage/uploads/schools/' . $schoolId . '/';
        if (!str_starts_with($relativePath, $prefix)) return null;
        $file = realpath(__DIR__ . '/../../' . $relativePath);
        $directory = realpath(__DIR__ . '/../../storage/uploads/schools/' . $schoolId);
        if (!$file || !$directory || !str_starts_with($file, $directory . '/') || !is_file($file)) return null;
        $mime = mime_content_type($file) ?: '';
        $content = file_get_contents($file);
        return str_starts_with($mime, 'image/') && $content !== false ? 'data:' . $mime . ';base64,' . base64_encode($content) : null;
    }
}
