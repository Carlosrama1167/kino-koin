<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
try { $pdo = db(); }
catch (Throwable $e) {
    fwrite(STDERR, $e instanceof PDOException
        ? "Koneksi PostgreSQL gagal. Pastikan .env ada di folder proyek, DB_PASSWORD benar, dan database kino_koin sudah dibuat.\n"
        : $e->getMessage() . "\n");
    exit(1);
}
$required = $pdo->query("SELECT to_regclass('public.users') AS users, to_regclass('public.outlets') AS outlets")->fetch();
if (!$required || !$required['users'] || !$required['outlets']) {
    fwrite(STDERR, "Skema belum terpasang. Jalankan database/schema.sql dan database/seed.sql terlebih dahulu.\n");
    exit(1);
}
$accounts = [
    ['name'=>'Owner KINO Laundry','username'=>'owner','role'=>'owner'],
    ['name'=>'Kasir KINO Laundry','username'=>'kasir','role'=>'kasir'],
    ['name'=>'Karyawan KINO Laundry','username'=>'karyawan','role'=>'karyawan'],
];
$check = $pdo->prepare('SELECT 1 FROM users WHERE LOWER(username)=LOWER(?)');
foreach ($accounts as $account) {
    $check->execute([$account['username']]);
    if ($check->fetchColumn()) {
        fwrite(STDERR, "Akun username '{$account['username']}' sudah ada. Tidak ada akun yang diubah.\n");
        exit(1);
    }
}
$outletId = $pdo->query('SELECT id FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1')->fetchColumn();
if (!$outletId) {
    fwrite(STDERR, "Belum ada outlet aktif. Jalankan database/seed.sql terlebih dahulu.\n");
    exit(1);
}
$insert = $pdo->prepare('INSERT INTO users(outlet_id,name,username,password_hash,role) VALUES(?,?,?,?,?)');
$credentials = [];
$pdo->beginTransaction();
try {
    foreach ($accounts as $account) {
        $password = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
        $insert->execute([$account['role']==='owner' ? null : $outletId,$account['name'],$account['username'],password_hash($password,PASSWORD_DEFAULT),$account['role']]);
        $credentials[] = ['username'=>$account['username'],'password'=>$password,'role'=>$account['role']];
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "Gagal membuat akun. Tidak ada perubahan yang disimpan. Periksa koneksi dan skema database.\n");
    exit(1);
}
echo "TIGA AKUN BERHASIL DIBUAT. Simpan kata sandi ini; kata sandi tidak disimpan dalam bentuk teks.\n";
foreach ($credentials as $account) {
    echo strtoupper($account['role']) . " | username: {$account['username']} | password sementara: {$account['password']}\n";
}
