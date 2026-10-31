<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Skrip ini hanya boleh dijalankan melalui CLI.\n");
    exit(1);
}

require dirname(__DIR__) . '/bootstrap.php';

$privateDirectory = dirname(__DIR__) . '/private';
$photoDirectory = $privateDirectory . '/attendance';
if (is_link($privateDirectory) || is_link($photoDirectory)) {
    throw new RuntimeException('Direktori privat absensi tidak aman.');
}
if (!is_dir($photoDirectory)) {
    fwrite(STDOUT, "Tidak ada direktori foto absensi yang perlu dibersihkan.\n");
    exit(0);
}
$privateRealPath = realpath($privateDirectory);
$photoRealPath = realpath($photoDirectory);
if ($privateRealPath === false || $photoRealPath === false
    || !str_starts_with($photoRealPath . DIRECTORY_SEPARATOR, $privateRealPath . DIRECTORY_SEPARATOR)) {
    throw new RuntimeException('Direktori foto absensi berada di luar area privat.');
}

$expired = db()->query(
    "SELECT photo_storage_key FROM attendance_events
     WHERE photo_storage_key IS NOT NULL AND photo_expires_at <= NOW()
     ORDER BY photo_expires_at, id"
);
$deleted = 0;
$failed = false;
while (($key = $expired->fetchColumn()) !== false) {
    if (!is_string($key) || !preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/', $key)) {
        fwrite(STDERR, "Kunci foto kedaluwarsa tidak valid; dilewati.\n");
        $failed = true;
        continue;
    }
    $path = $photoRealPath . DIRECTORY_SEPARATOR . $key;
    if (is_link($path)) {
        fwrite(STDERR, "Berkas foto kedaluwarsa berupa symbolic link; dilewati: {$key}\n");
        $failed = true;
        continue;
    }
    if (!file_exists($path)) {
        continue;
    }
    if (!is_file($path) || !unlink($path)) {
        fwrite(STDERR, "Gagal menghapus foto kedaluwarsa: {$key}\n");
        $failed = true;
        continue;
    }
    $deleted++;
}

fwrite(STDOUT, "Foto absensi kedaluwarsa dihapus: {$deleted}\n");
exit($failed ? 1 : 0);
