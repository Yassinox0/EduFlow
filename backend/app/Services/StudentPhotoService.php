<?php
declare(strict_types=1);
namespace App\Services;
use App\Core\Request;

class StudentPhotoService
{
    public function upload(array $file): array
    {
        $user=Request::get('auth_user',[]);$schoolId=(int)($user['school_id']??0);
        if(!$schoolId)return ['error'=>'School is required'];
        if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)return ['error'=>'Photo upload failed'];
        if(($file['size']??0)>5*1024*1024)return ['error'=>'Photo must not exceed 5 MB'];
        $mime=(new \finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);$extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
        if(!isset($extensions[$mime]))return ['error'=>'Only JPG, PNG and WEBP images are accepted'];
        $directory=__DIR__.'/../../public/uploads/students/'.$schoolId;
        if(!is_dir($directory)&&!mkdir($directory,0755,true))return ['error'=>'Unable to prepare photo storage'];
        $filename='student_'.bin2hex(random_bytes(10)).'.'.$extensions[$mime];
        if(!move_uploaded_file((string)$file['tmp_name'],$directory.'/'.$filename))return ['error'=>'Unable to store photo'];
        return ['photo_path'=>'uploads/students/'.$schoolId.'/'.$filename];
    }
}
