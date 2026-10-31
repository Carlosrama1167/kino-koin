<?php
declare(strict_types=1);

$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile)) {
    foreach (parse_ini_file($envFile, false, INI_SCANNER_RAW) ?: [] as $key => $value) {
        if (getenv((string)$key) === false) putenv($key . '=' . $value);
    }
}
date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'Asia/Jakarta');

function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $password = getenv('DB_PASSWORD');
        if ($password === false || $password === '' || $password === 'isi_password_postgresql_lokal') {
            throw new RuntimeException('Konfigurasi database belum lengkap: buat file .env dari .env.example dan isi DB_PASSWORD dengan kata sandi PostgreSQL.');
        }
        $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', getenv('DB_HOST') ?: '127.0.0.1', getenv('DB_PORT') ?: '5432', getenv('DB_NAME') ?: 'kino_koin');
        $pdo = new PDO($dsn, getenv('DB_USER') ?: 'postgres', $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
    }
    return $pdo;
}
function json_out(array $data, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit;
}
function body(): array { return json_decode(file_get_contents('php://input') ?: '[]', true) ?: []; }
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $q = db()->prepare('SELECT id,name,username,email,role,outlet_id FROM users WHERE id=? AND is_active=TRUE'); $q->execute([$_SESSION['user_id']]);
    return $q->fetch() ?: null;
}
function require_user(?string $role = null): array {
    $user = current_user();
    if (!$user) json_out(['error'=>'Sesi login tidak ditemukan.'], 401);
    if ($role && $user['role'] !== $role) json_out(['error'=>'Anda tidak memiliki akses ke halaman ini.'], 403);
    return $user;
}
function require_csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!$token || !hash_equals($_SESSION['csrf'] ?? '', $token)) json_out(['error'=>'Token keamanan tidak valid. Muat ulang halaman.'], 419);
}
