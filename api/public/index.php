<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name(getenv('APP_SESSION_NAME') ?: 'kino_pos_session');
session_set_cookie_params(['httponly'=>true,'secure'=>$secure,'samesite'=>'Lax','path'=>'/']);
session_start();
$method = $_SERVER['REQUEST_METHOD']; $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$ownerOutletId = static function (): int {
    $outletId=(int)db()->query('SELECT id FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1')->fetchColumn();
    if (!$outletId) json_out(['error'=>'Outlet aktif belum tersedia.'],409);
    return $outletId;
};
$ownerDateRange = static function (): array {
    $timezone = new DateTimeZone('Asia/Jakarta');
    $now = new DateTimeImmutable('now', $timezone);
    $period = $_GET['period'] ?? 'month';

    if ($period === 'custom') {
        $from = $_GET['from'] ?? '';
        $to = $_GET['to'] ?? '';
        $start = DateTimeImmutable::createFromFormat('!Y-m-d', $from, $timezone);
        $end = DateTimeImmutable::createFromFormat('!Y-m-d', $to, $timezone);
        if (!$start || !$end || $start->format('Y-m-d') !== $from || $end->format('Y-m-d') !== $to || $start > $end) {
            json_out(['error'=>'Rentang tanggal tidak valid.'], 422);
        }
        return [$start, $end->modify('+1 day'), 'custom'];
    }

    $today = $now->setTime(0, 0);
    if ($period === 'today') return [$today, $today->modify('+1 day'), $period];
    if ($period === '7days') return [$today->modify('-6 days'), $today->modify('+1 day'), $period];
    if ($period === 'month') {
        $start = $today->modify('first day of this month');
        return [$start, $start->modify('+1 month'), $period];
    }
    json_out(['error'=>'Periode laporan tidak valid.'], 422);
};
$expenseLedgerReady = static function (): bool {
    $value=db()->query("SELECT to_regclass('public.expenses') IS NOT NULL")->fetchColumn();
    return $value===true || $value==='t' || $value===1 || $value==='1';
};
$attendanceValidateLocation = static function (PDO $pdo, int $outletId, array $input): array {
    $latitude=$input['latitude']??null;
    $longitude=$input['longitude']??null;
    $accuracy=$input['accuracy']??null;
    $timestamp=$input['location_timestamp']??null;
    if (!is_numeric($latitude) || !is_numeric($longitude) || !is_numeric($accuracy)
        || !is_finite((float)$latitude) || !is_finite((float)$longitude) || !is_finite((float)$accuracy)
        || (float)$latitude < -90 || (float)$latitude > 90 || (float)$longitude < -180 || (float)$longitude > 180
        || (float)$accuracy <= 0 || (float)$accuracy > 100 || !is_numeric($timestamp)
        || !is_finite((float)$timestamp) || abs((int)floor(microtime(true)*1000)-(int)$timestamp)>120000) {
        json_out(['error'=>'Lokasi GPS tidak valid, kedaluwarsa, atau akurasinya lebih dari 100 meter. Aktifkan lokasi presisi lalu coba lagi.'],422);
    }
    $q=$pdo->prepare('SELECT attendance_latitude,attendance_longitude FROM outlets WHERE id=? AND is_active=TRUE');
    $q->execute([$outletId]); $outlet=$q->fetch();
    if (!$outlet || $outlet['attendance_latitude']===null || $outlet['attendance_longitude']===null) {
        json_out(['error'=>'Lokasi outlet belum diatur Owner. Hubungi Owner sebelum melakukan absensi.'],409);
    }
    $lat1=deg2rad((float)$latitude); $lat2=deg2rad((float)$outlet['attendance_latitude']);
    $latDelta=$lat2-$lat1; $lonDelta=deg2rad((float)$outlet['attendance_longitude']-(float)$longitude);
    $a=sin($latDelta/2)**2+cos($lat1)*cos($lat2)*sin($lonDelta/2)**2;
    $distance=6371000*2*atan2(sqrt($a),sqrt(max(0,1-$a)));
    if ($distance>100) json_out(['error'=>'Anda berada di luar area absensi outlet (radius 100 meter).'],403);
    return ['latitude'=>(float)$latitude,'longitude'=>(float)$longitude,'accuracy'=>(float)$accuracy,'timestamp'=>(int)$timestamp,'distance'=>(int)round($distance)];
};
$attendanceCurrentSchedule = static function (PDO $pdo): ?array {
    $q=$pdo->query("SELECT shift_type,start_time::text AS start_time,end_time::text AS end_time,timezone FROM shift_schedules WHERE is_active AND ((start_time<end_time AND (NOW() AT TIME ZONE timezone)::time>=start_time AND (NOW() AT TIME ZONE timezone)::time<end_time) OR (start_time>=end_time AND ((NOW() AT TIME ZONE timezone)::time>=start_time OR (NOW() AT TIME ZONE timezone)::time<end_time))) ORDER BY start_time LIMIT 1");
    return $q->fetch() ?: null;
};
$attendanceShiftEnd = static function (PDO $pdo, string $shiftType, string $workDate): ?DateTimeImmutable {
    $q=$pdo->prepare('SELECT start_time::text AS start_time,end_time::text AS end_time,timezone FROM shift_schedules WHERE shift_type=? AND is_active');
    $q->execute([$shiftType]); $schedule=$q->fetch();
    if (!$schedule) return null;
    $timezone=new DateTimeZone($schedule['timezone']);
    $start=substr($schedule['start_time'],0,8);
    $end=substr($schedule['end_time'],0,8);
    $endAt=new DateTimeImmutable($workDate.' '.$end,$timezone);
    if ($end<=$start) $endAt=$endAt->modify('+1 day');
    return $endAt;
};
$attendancePhotoDirectory = static fn(): string => dirname(__DIR__).'/private/attendance';
$attendanceSafeguardsReady = static function (PDO $pdo): bool {
    $events=$pdo->query("SELECT to_regclass('public.attendance_events') IS NOT NULL")->fetchColumn();
    $shift=$pdo->query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employee_attendance' AND column_name='shift_type')")->fetchColumn();
    $outlet=$pdo->query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='outlets' AND column_name='attendance_checkout_grace_minutes')")->fetchColumn();
    return ($events===true||$events==='t'||$events===1||$events==='1')
        && ($shift===true||$shift==='t'||$shift===1||$shift==='1')
        && ($outlet===true||$outlet==='t'||$outlet===1||$outlet==='1');
};
try {
    if ($method === 'GET' && $path === '/api/auth/csrf') {
        $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); json_out(['csrf'=>$_SESSION['csrf']]);
    }
    if ($method === 'POST' && $path === '/api/auth/login') {
        require_csrf(); $input=body(); $identity=trim((string)($input['identity'] ?? ''));
        $q=db()->prepare('SELECT id,name,username,email,role,outlet_id,password_hash FROM users WHERE is_active=TRUE AND (LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?)) LIMIT 1'); $q->execute([$identity,$identity]); $row=$q->fetch();
        if (!$row || !password_verify((string)($input['password'] ?? ''),$row['password_hash'])) json_out(['error'=>'Nama pengguna/email atau kata sandi salah.'], 422);
        session_regenerate_id(true); $_SESSION['user_id']=(int)$row['id']; $_SESSION['csrf']=bin2hex(random_bytes(32)); unset($row['password_hash']); json_out(['user'=>$row,'csrf'=>$_SESSION['csrf']]);
    }
    if ($method === 'GET' && $path === '/api/auth/me') { $u=current_user(); json_out(['user'=>$u]); }
    if ($method === 'POST' && $path === '/api/auth/logout') { require_csrf(); $_SESSION=[]; session_destroy(); json_out(['ok'=>true]); }

    if ($method === 'GET' && $path === '/api/services') {
        require_user('kasir'); $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')); $night=(int)$now->format('G') >= 23 || (int)$now->format('G') < 6;
        $sql="SELECT s.id,s.code,s.name,s.category,s.pricing_unit,s.base_price,COALESCE((SELECT sp.price FROM service_prices sp WHERE sp.service_id=s.id AND sp.price_type=? AND sp.is_active ORDER BY sp.id DESC LIMIT 1),s.base_price) AS unit_price FROM services s WHERE s.is_active ORDER BY s.category,s.name";
        $q=db()->prepare($sql); $q->execute([$night?'malam':'normal']); json_out(['items'=>$q->fetchAll(),'price_type'=>$night?'malam':'normal']);
    }
    if ($method === 'GET' && $path === '/api/products') {
        require_user('kasir'); $q=db()->query('SELECT id,name,category,price,stock,minimum_stock,unit FROM products WHERE is_active ORDER BY name'); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/api/inventory/movements') {
        $u=require_user(); if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke inventaris.'],403);
        $productId=filter_var($_GET['product_id']??null,FILTER_VALIDATE_INT);
        if (isset($_GET['product_id']) && !$productId) json_out(['error'=>'Produk tidak valid.'],422);
        $limit=min(200,max(1,(int)($_GET['limit']??100)));
        $hasExpenseLedger=$expenseLedgerReady();
        $expenseFields=$hasExpenseLedger?'im.expense_id,e.expense_number':'NULL::integer AS expense_id,NULL::text AS expense_number';
        $expenseJoin=$hasExpenseLedger?'LEFT JOIN expenses e ON e.id=im.expense_id':'';
        $sql="SELECT im.id,im.product_id,p.name AS product,p.unit,im.quantity,im.movement_type,im.direction,im.reason,im.created_at,u.name AS operator,{$expenseFields}
            FROM inventory_movements im JOIN products p ON p.id=im.product_id LEFT JOIN users u ON u.id=im.user_id {$expenseJoin}";
        $params=[];
        if ($productId) { $sql.=' WHERE im.product_id=?'; $params[]=$productId; }
        $sql.=' ORDER BY im.created_at DESC,im.id DESC LIMIT ?';
        $q=db()->prepare($sql); $q->execute([...$params,$limit]); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'POST' && $path === '/api/inventory/movements') {
        require_csrf(); $u=require_user(); if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke inventaris.'],403);
        $i=body(); $productId=filter_var($i['product_id']??null,FILTER_VALIDATE_INT); $movementType=$i['movement_type']??''; $reason=trim((string)($i['reason']??''));
        if (!$productId || !in_array($movementType,['masuk','penyesuaian'],true) || $reason==='' || strlen($reason)>500) json_out(['error'=>'Produk, jenis mutasi, dan alasan wajib diisi.'],422);
        $expenseId=filter_var($i['expense_id']??null,FILTER_VALIDATE_INT);
        $idempotencyKey=trim((string)($i['idempotency_key']??''));
        if (isset($i['expense_id']) && (!$expenseId || $movementType!=='masuk' || !preg_match('/^[A-Za-z0-9._:-]{8,100}$/',$idempotencyKey))) json_out(['error'=>'Penerimaan stok tertaut memerlukan pengeluaran, stok masuk, dan kunci idempotensi yang valid.'],422);
        if($expenseId && !$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan; mutasi stok tertaut belum tersedia.'],503);
        $quantity=0.0; $targetStock=null;
        if ($movementType==='masuk') {
            if (!is_numeric($i['quantity']??null) || !is_finite((float)$i['quantity']) || (float)$i['quantity']<=0) json_out(['error'=>'Jumlah stok masuk harus lebih besar dari nol.'],422);
            $quantity=round((float)$i['quantity'],2);
        } else {
            if (!is_numeric($i['stock_count']??null) || !is_finite((float)$i['stock_count']) || (float)$i['stock_count']<0) json_out(['error'=>'Hasil hitung fisik tidak valid.'],422);
            $targetStock=round((float)$i['stock_count'],2);
        }
        $requestHash=hash('sha256',json_encode([
            'product_id'=>(int)$productId,
            'movement_type'=>$movementType,
            'quantity'=>$quantity,
            'stock_count'=>$targetStock,
            'reason'=>$reason,
            'expense_id'=>$expenseId ?: null,
        ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
        $pdo=db(); $pdo->beginTransaction(); $q=$pdo->prepare('SELECT id,stock FROM products WHERE id=? AND is_active FOR UPDATE'); $q->execute([$productId]); $product=$q->fetch();
        if (!$product) { $pdo->rollBack(); json_out(['error'=>'Produk tidak ditemukan atau tidak aktif.'],404); }
        if ($expenseId) {
            $q=$pdo->prepare('SELECT id FROM expenses WHERE id=? AND outlet_id=? FOR UPDATE');
            $q->execute([$expenseId,(int)$u['outlet_id']]);
            if (!$q->fetch()) { $pdo->rollBack(); json_out(['error'=>'Pengeluaran tidak ditemukan pada outlet ini.'],404); }
            $q=$pdo->prepare('SELECT id,request_hash FROM inventory_movements WHERE idempotency_key=?');
            $q->execute([$idempotencyKey]); $duplicate=$q->fetch();
            if ($duplicate) {
                if (!hash_equals(trim((string)$duplicate['request_hash']),$requestHash)) { $pdo->rollBack(); json_out(['error'=>'Kunci penerimaan stok sudah digunakan dengan data berbeda.'],409); }
                $q=$pdo->prepare('SELECT stock FROM products WHERE id=?');
                $q->execute([$productId]); $stock=(float)$q->fetchColumn();
                $pdo->commit(); json_out(['ok'=>true,'duplicate'=>true,'stock'=>$stock,'movement'=>['id'=>(int)$duplicate['id']]]);
            }
        }
        $current=(float)$product['stock']; $next=$movementType==='masuk'?round($current+$quantity,2):$targetStock; $delta=round($next-$current,2);
        if ($delta<0 && $next<0) { $pdo->rollBack(); json_out(['error'=>'Stok tidak boleh menjadi negatif.'],409); }
        if ($delta===0.0) { $pdo->commit(); json_out(['ok'=>true,'stock'=>$next,'movement'=>null]); }
        $direction=$delta>0?'masuk':'keluar'; $movementQuantity=abs($delta);
        $q=$pdo->prepare('UPDATE products SET stock=? WHERE id=?'); $q->execute([$next,$productId]);
        if($expenseId) {
            $q=$pdo->prepare("INSERT INTO inventory_movements(product_id,quantity,movement_type,direction,user_id,reason,expense_id,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id,created_at");
            $q->execute([$productId,$movementQuantity,$movementType,$direction,$u['id'],$reason,$expenseId,$idempotencyKey,$requestHash]);
        } else {
            $q=$pdo->prepare("INSERT INTO inventory_movements(product_id,quantity,movement_type,direction,user_id,reason) VALUES(?,?,?,?,?,?) RETURNING id,created_at");
            $q->execute([$productId,$movementQuantity,$movementType,$direction,$u['id'],$reason]);
        }
        $movement=$q->fetch();
        $pdo->commit(); json_out(['ok'=>true,'stock'=>$next,'movement'=>$movement],201);
    }
    if ($method === 'GET' && $path === '/api/coins') {
        $u=require_user(); if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke koin.'],403);
        $q=db()->query('SELECT id,name,description,stock FROM coin_types WHERE is_active ORDER BY id'); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/api/coins/movements') {
        $u=require_user(); if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke koin.'],403);
        $limit=min(200,max(1,(int)($_GET['limit']??100)));
        $q=db()->prepare('SELECT cm.id,cm.coin_type_id,ct.name AS coin,cm.quantity,cm.movement_type,cm.direction,cm.reason,cm.created_at,cm.transaction_id,cm.shift_id,u.name AS operator FROM coin_movements cm JOIN coin_types ct ON ct.id=cm.coin_type_id LEFT JOIN users u ON u.id=cm.user_id ORDER BY cm.created_at DESC,cm.id DESC LIMIT ?');
        $q->execute([$limit]); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'POST' && $path === '/api/coins/movements') {
        require_csrf(); $u=require_user(); if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke koin.'],403);
        $i=body(); $coinId=filter_var($i['coin_type_id']??null,FILTER_VALIDATE_INT); $movementType=$i['movement_type']??''; $reason=trim((string)($i['reason']??''));
        if (!$coinId || !in_array($movementType,['masuk','keluar','penyesuaian'],true) || $reason==='' || strlen($reason)>500) json_out(['error'=>'Jenis koin, jenis mutasi, dan alasan wajib diisi.'],422);
        if ($movementType==='penyesuaian') {
            if (!is_numeric($i['stock_count']??null) || !is_finite((float)$i['stock_count']) || (float)$i['stock_count']<0 || floor((float)$i['stock_count'])!==(float)$i['stock_count']) json_out(['error'=>'Hasil hitung fisik koin tidak valid.'],422);
            $target=(int)$i['stock_count']; $quantity=null;
        } else {
            if (!filter_var($i['quantity']??null,FILTER_VALIDATE_INT) || (int)$i['quantity']<1) json_out(['error'=>'Jumlah koin harus bilangan bulat lebih besar dari nol.'],422);
            $quantity=(int)$i['quantity']; $target=null;
        }
        $pdo=db(); $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id FROM shifts WHERE user_id=? AND status='open' FOR UPDATE"); $q->execute([$u['id']]); $shift=$q->fetch();
        if (!$shift) { $pdo->rollBack(); json_out(['error'=>'Buka shift sebelum mencatat mutasi koin.'],409); }
        $q=$pdo->prepare('SELECT id,stock FROM coin_types WHERE id=? AND is_active FOR UPDATE'); $q->execute([$coinId]); $coin=$q->fetch();
        if (!$coin) { $pdo->rollBack(); json_out(['error'=>'Jenis koin tidak ditemukan atau tidak aktif.'],404); }
        $current=(int)$coin['stock'];
        if ($movementType==='masuk') { $next=$current+$quantity; $direction='masuk'; $movementQuantity=$quantity; }
        elseif ($movementType==='keluar') {
            if ($quantity>$current) { $pdo->rollBack(); json_out(['error'=>'Jumlah koin keluar melebihi stok tersedia.'],409); }
            $next=$current-$quantity; $direction='keluar'; $movementQuantity=$quantity;
        } else {
            $delta=$target-$current;
            if ($delta===0) { $pdo->commit(); json_out(['ok'=>true,'stock'=>$target,'movement'=>null]); }
            $next=$target; $direction=$delta>0?'masuk':'keluar'; $movementQuantity=abs($delta);
        }
        $q=$pdo->prepare('UPDATE coin_types SET stock=? WHERE id=?'); $q->execute([$next,$coinId]);
        $q=$pdo->prepare('INSERT INTO coin_movements(coin_type_id,shift_id,quantity,movement_type,direction,user_id,reason) VALUES(?,?,?,?,?,?,?) RETURNING id,created_at');
        $q->execute([$coinId,$shift['id'],$movementQuantity,$movementType,$direction,$u['id'],$reason]); $movement=$q->fetch();
        $pdo->commit(); json_out(['ok'=>true,'stock'=>$next,'movement'=>$movement],201);
    }
    if ($method === 'GET' && $path === '/api/attendance/me') {
        $u=require_user('karyawan');
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan. Hubungi administrator.'],503);
        $schedule=$attendanceCurrentSchedule($pdo);
        $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes,
            CASE WHEN check_out_at IS NOT NULL AND NOW()<=check_out_at+INTERVAL '2 minutes' THEN check_out_at+INTERVAL '2 minutes' ELSE NULL END AS undo_until
            FROM employee_attendance WHERE user_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC,id DESC LIMIT 1");
        $q->execute([(int)$u['id']]); $openAttendance=$q->fetch() ?: null;
        $currentAttendance=null;
        if($schedule) {
            $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes,
                CASE WHEN check_out_at IS NOT NULL AND NOW()<=check_out_at+INTERVAL '2 minutes' THEN check_out_at+INTERVAL '2 minutes' ELSE NULL END AS undo_until
                FROM employee_attendance WHERE user_id=? AND work_date=(NOW() AT TIME ZONE 'Asia/Jakarta')::date AND shift_type=? LIMIT 1");
            $q->execute([(int)$u['id'],$schedule['shift_type']]); $currentAttendance=$q->fetch() ?: null;
        }
        $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes,
            CASE WHEN check_out_at IS NOT NULL AND NOW()<=check_out_at+INTERVAL '2 minutes' THEN check_out_at+INTERVAL '2 minutes' ELSE NULL END AS undo_until
            FROM employee_attendance WHERE user_id=? AND work_date>=(NOW() AT TIME ZONE 'Asia/Jakarta')::date-1
            ORDER BY check_in_at DESC,id DESC LIMIT 5");
        $q->execute([(int)$u['id']]); $recent=$q->fetchAll();
        $withShiftEnd=static function (?array $row) use ($attendanceShiftEnd,$pdo): ?array {
            if($row) {
                $shiftEnd=$attendanceShiftEnd($pdo,(string)$row['shift_type'],(string)$row['work_date']);
                $row['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
            }
            return $row;
        };
        $openAttendance=$withShiftEnd($openAttendance);
        $currentAttendance=$withShiftEnd($currentAttendance);
        $attendance=$openAttendance ?: ($currentAttendance ?: ($recent[0]??null));
        if($attendance) {
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$attendance['shift_type'],(string)$attendance['work_date']);
            $attendance['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
        }
        $q=$pdo->prepare('SELECT attendance_checkout_grace_minutes FROM outlets WHERE id=?');
        $q->execute([(int)$u['outlet_id']]); $grace=$q->fetchColumn();
        json_out([
            'attendance'=>$attendance,
            'open_attendance'=>$openAttendance,
            'current_shift_attendance'=>$currentAttendance,
            'current_shift'=>$schedule,
            'can_check_in'=>(bool)$schedule && !$openAttendance && !$currentAttendance,
            'recent'=>$recent,
            'checkout_grace_minutes'=>$grace===false?30:(int)$grace,
        ]);
    }
    if ($method === 'POST' && $path === '/api/attendance/check-in') {
        require_csrf(); $u=require_user('karyawan'); $input=body();
        $key=trim((string)($input['idempotency_key']??''));
        if(!preg_match('/^[A-Za-z0-9._:-]{8,100}$/',$key)) json_out(['error'=>'Kunci absensi tidak valid. Muat ulang halaman lalu coba lagi.'],422);
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $q=$pdo->prepare("SELECT a.id,a.work_date,a.shift_type,a.check_in_at,a.check_out_at,a.checkout_reason,a.status,a.notes FROM attendance_events e JOIN employee_attendance a ON a.id=e.attendance_id WHERE e.actor_user_id=? AND e.idempotency_key=? AND e.event_type='check_in' LIMIT 1");
        $q->execute([(int)$u['id'],$key]); $duplicate=$q->fetch();
        if($duplicate) {
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$duplicate['shift_type'],(string)$duplicate['work_date']);
            $duplicate['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
            json_out(['attendance'=>$duplicate,'duplicate'=>true]);
        }
        if(empty($u['outlet_id'])) json_out(['error'=>'Akun karyawan belum ditautkan ke outlet. Hubungi Owner.'],409);
        $location=$attendanceValidateLocation($pdo,(int)$u['outlet_id'],$input);
        $schedule=$attendanceCurrentSchedule($pdo);
        if(!$schedule) json_out(['error'=>'Tidak ada jadwal shift yang sedang aktif. Absensi masuk hanya dapat dilakukan pada jam shift yang ditetapkan.'],409);
        $pdo->beginTransaction();
        try {
            $q=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE'); $q->execute([(int)$u['id']]); $q->fetch();
            $open=$pdo->prepare('SELECT shift_type FROM employee_attendance WHERE user_id=? AND check_out_at IS NULL LIMIT 1');
            $open->execute([(int)$u['id']]); $existingOpen=$open->fetchColumn();
            if($existingOpen!==false) { $pdo->rollBack(); json_out(['error'=>'Selesaikan absensi shift '.ucfirst((string)$existingOpen).' terlebih dahulu sebelum absen masuk shift berikutnya.'],409); }
            $q=$pdo->query("SELECT (NOW() AT TIME ZONE 'Asia/Jakarta')::date AS work_date");
            $workDate=(string)$q->fetchColumn();
            $q=$pdo->prepare("INSERT INTO employee_attendance(outlet_id,user_id,work_date,shift_type,check_in_at,status) VALUES(?,?,?::date,?,NOW(),'hadir') ON CONFLICT (user_id,work_date,shift_type) WHERE shift_type IS NOT NULL DO NOTHING RETURNING id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes");
            $q->execute([(int)$u['outlet_id'],(int)$u['id'],$workDate,$schedule['shift_type']]); $attendance=$q->fetch();
            if(!$attendance) {
                $q=$pdo->prepare('SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes FROM employee_attendance WHERE user_id=? AND work_date=?::date AND shift_type=?');
                $q->execute([(int)$u['id'],$workDate,$schedule['shift_type']]); $existing=$q->fetch();
                if($existing) {
                    $shiftEnd=$attendanceShiftEnd($pdo,(string)$existing['shift_type'],(string)$existing['work_date']);
                    $existing['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
                }
                $pdo->commit();
                json_out(['attendance'=>$existing,'duplicate'=>true]);
            }
            $q=$pdo->prepare("INSERT INTO attendance_events(attendance_id,actor_user_id,event_type,attendance_time_after,latitude,longitude,accuracy_meters,idempotency_key) VALUES(?,?,'check_in',?,?,?, ?,?)");
            $q->execute([(int)$attendance['id'],(int)$u['id'],$attendance['check_in_at'],$location['latitude'],$location['longitude'],$location['accuracy'],$key]);
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$attendance['shift_type'],(string)$attendance['work_date']);
            $attendance['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
            $pdo->commit();
            json_out(['attendance'=>$attendance,'duplicate'=>false],201);
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    if ($method === 'POST' && $path === '/api/attendance/check-out') {
        require_csrf(); $u=require_user('karyawan');
        $input=$_POST?:body();
        $key=trim((string)($input['idempotency_key']??''));
        $reason=trim((string)($input['reason']??''));
        if(!preg_match('/^[A-Za-z0-9._:-]{8,100}$/',$key)) json_out(['error'=>'Kunci absensi pulang tidak valid.'],422);
        if($reason!=='' && !in_array($reason,['Izin','Sakit','Diizinkan owner','Lainnya'],true)) json_out(['error'=>'Alasan pulang lebih awal tidak valid.'],422);
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $q=$pdo->prepare("SELECT a.id,a.work_date,a.shift_type,a.check_in_at,a.check_out_at,a.checkout_reason,a.status,a.notes FROM attendance_events e JOIN employee_attendance a ON a.id=e.attendance_id WHERE e.actor_user_id=? AND e.idempotency_key=? AND e.event_type='check_out' LIMIT 1");
        $q->execute([(int)$u['id'],$key]); $duplicate=$q->fetch();
        if($duplicate) json_out([
            'attendance'=>$duplicate,
            'undo_until'=>$duplicate['check_out_at'] ? (new DateTimeImmutable((string)$duplicate['check_out_at']))->modify('+2 minutes')->format(DateTimeInterface::ATOM) : null,
            'duplicate'=>true,
        ]);
        if(empty($u['outlet_id'])) json_out(['error'=>'Akun karyawan belum ditautkan ke outlet. Hubungi Owner.'],409);
        $location=$attendanceValidateLocation($pdo,(int)$u['outlet_id'],$input);
        $file=$_FILES['photo']??null;
        if(!$file || !isset($file['error']) || $file['error']!==UPLOAD_ERR_OK) json_out(['error'=>'Selfie pulang wajib diambil setelah konfirmasi.'],422);
        if((int)$file['size']<=0 || (int)$file['size']>5242880 || !is_uploaded_file((string)$file['tmp_name'])) json_out(['error'=>'Selfie harus berukuran maksimal 5 MB.'],422);
        $finfo=finfo_open(FILEINFO_MIME_TYPE);
        if($finfo===false) json_out(['error'=>'Validasi foto tidak tersedia pada server.'],500);
        $mime=finfo_file($finfo,(string)$file['tmp_name']); finfo_close($finfo);
        $extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
        if(!is_string($mime) || !isset($extensions[$mime]) || @getimagesize((string)$file['tmp_name'])===false) json_out(['error'=>'Selfie harus berupa gambar JPG, PNG, atau WebP yang valid.'],422);
        $graceQuery=$pdo->prepare('SELECT attendance_checkout_grace_minutes FROM outlets WHERE id=? AND is_active=TRUE');
        $graceQuery->execute([(int)$u['outlet_id']]); $grace=(int)$graceQuery->fetchColumn();
        $pdo->beginTransaction();
        $storedPath=null;
        try {
            $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes FROM employee_attendance WHERE user_id=? AND check_out_at IS NULL ORDER BY check_in_at DESC,id DESC LIMIT 1 FOR UPDATE");
            $q->execute([(int)$u['id']]); $attendance=$q->fetch();
            if(!$attendance) {
                $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes FROM employee_attendance WHERE user_id=? AND check_out_at IS NOT NULL AND work_date>=((NOW() AT TIME ZONE 'Asia/Jakarta')::date-1) ORDER BY check_out_at DESC,id DESC LIMIT 1");
                $q->execute([(int)$u['id']]); $already=$q->fetch();
                $pdo->commit();
                if($already) json_out([
                    'attendance'=>$already,
                    'undo_until'=>(new DateTimeImmutable((string)$already['check_out_at']))->modify('+2 minutes')->format(DateTimeInterface::ATOM),
                    'duplicate'=>true,
                ]);
                json_out(['error'=>'Tidak ada absensi masuk aktif untuk ditutup.'],409);
            }
            $checkInAt=new DateTimeImmutable((string)$attendance['check_in_at']);
            $now=new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta'));
            $availableAt=$checkInAt->modify('+'.$grace.' minutes');
            if($now<$availableAt) {
                $pdo->rollBack();
                json_out(['error'=>'Belum melewati jeda minimum sebelum absen pulang.','available_at'=>$availableAt->format(DateTimeInterface::ATOM)],409);
            }
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$attendance['shift_type'],(string)$attendance['work_date']);
            $early=$shiftEnd!==null && $now<$shiftEnd;
            if($early && $reason==='') {
                $pdo->rollBack();
                json_out(['error'=>'Alasan wajib dipilih untuk pulang sebelum jadwal shift berakhir.','shift_end_at'=>$shiftEnd->format(DateTimeInterface::ATOM)],422);
            }
            if(!$early && $reason!=='') {
                $pdo->rollBack();
                json_out(['error'=>'Alasan pulang lebih awal hanya berlaku sebelum jadwal shift berakhir.'],422);
            }
            $directory=$attendancePhotoDirectory();
            if(is_link(dirname(__DIR__).'/private') || is_link($directory)) { $pdo->rollBack(); json_out(['error'=>'Lokasi penyimpanan selfie tidak aman.'],500); }
            if(!is_dir($directory) && !mkdir($directory,0700,true) && !is_dir($directory)) { $pdo->rollBack(); json_out(['error'=>'Direktori selfie tidak dapat disiapkan.'],500); }
            $photoKey=bin2hex(random_bytes(24)).'.'.$extensions[$mime];
            $storedPath=$directory.'/'.$photoKey;
            if(!move_uploaded_file((string)$file['tmp_name'],$storedPath)) { $pdo->rollBack(); json_out(['error'=>'Selfie gagal disimpan.'],500); }
            $q=$pdo->prepare("UPDATE employee_attendance SET check_out_at=NOW(),checkout_reason=? WHERE id=? RETURNING id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes");
            $q->execute([$reason?:null,(int)$attendance['id']]); $updated=$q->fetch();
            $q=$pdo->prepare("INSERT INTO attendance_events(attendance_id,actor_user_id,event_type,reason,attendance_time_before,attendance_time_after,latitude,longitude,accuracy_meters,photo_storage_key,photo_mime,photo_size,photo_expires_at,idempotency_key) VALUES(?,?,'check_out',?,NULL,?,?,?, ?,?,?,?,NOW()+INTERVAL '30 days',?)");
            $q->execute([(int)$attendance['id'],(int)$u['id'],$reason?:null,$updated['check_out_at'],$location['latitude'],$location['longitude'],$location['accuracy'],$photoKey,$mime,(int)$file['size'],$key]);
            $pdo->commit();
            json_out(['attendance'=>$updated,'undo_until'=>(new DateTimeImmutable((string)$updated['check_out_at']))->modify('+2 minutes')->format(DateTimeInterface::ATOM),'duplicate'=>false],201);
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            if($storedPath && is_file($storedPath) && !unlink($storedPath)) error_log('KINO POS: gagal membersihkan selfie absensi '.$storedPath);
            throw $error;
        }
    }
    if ($method === 'POST' && $path === '/api/attendance/cancel-check-out') {
        require_csrf(); $u=require_user('karyawan'); $input=body();
        $key=trim((string)($input['idempotency_key']??''));
        if(!preg_match('/^[A-Za-z0-9._:-]{8,100}$/',$key)) json_out(['error'=>'Kunci pembatalan tidak valid.'],422);
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $q=$pdo->prepare("SELECT a.id,a.work_date,a.shift_type,a.check_in_at,a.check_out_at,a.checkout_reason,a.status,a.notes FROM attendance_events e JOIN employee_attendance a ON a.id=e.attendance_id WHERE e.actor_user_id=? AND e.idempotency_key=? AND e.event_type='checkout_cancelled' LIMIT 1");
        $q->execute([(int)$u['id'],$key]); $duplicate=$q->fetch();
        if($duplicate) {
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$duplicate['shift_type'],(string)$duplicate['work_date']);
            $duplicate['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
            json_out(['attendance'=>$duplicate,'duplicate'=>true]);
        }
        $pdo->beginTransaction();
        try {
            $q=$pdo->prepare("SELECT id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status,notes FROM employee_attendance WHERE user_id=? AND check_out_at IS NOT NULL AND check_out_at>=NOW()-INTERVAL '2 minutes' ORDER BY check_out_at DESC,id DESC LIMIT 1 FOR UPDATE");
            $q->execute([(int)$u['id']]); $attendance=$q->fetch();
            if(!$attendance) { $pdo->rollBack(); json_out(['error'=>'Batas 2 menit untuk membatalkan absen pulang sudah lewat.'],409); }
            $q=$pdo->prepare("UPDATE employee_attendance SET check_out_at=NULL,checkout_reason=NULL WHERE id=? AND check_out_at>=NOW()-INTERVAL '2 minutes' RETURNING id");
            $q->execute([(int)$attendance['id']]);
            if(!$q->fetch()) { $pdo->rollBack(); json_out(['error'=>'Batas 2 menit untuk membatalkan absen pulang sudah lewat.'],409); }
            $q=$pdo->prepare("INSERT INTO attendance_events(attendance_id,actor_user_id,event_type,reason,attendance_time_before,attendance_time_after,idempotency_key) VALUES(?,?,'checkout_cancelled','Salah tekan',?,NULL,?)");
            $q->execute([(int)$attendance['id'],(int)$u['id'],$attendance['check_out_at'],$key]);
            $shiftEnd=$attendanceShiftEnd($pdo,(string)$attendance['shift_type'],(string)$attendance['work_date']);
            $attendance['shift_end_at']=$shiftEnd?->format(DateTimeInterface::ATOM);
            $pdo->commit();
            $attendance['check_out_at']=null; $attendance['checkout_reason']=null;
            json_out(['attendance'=>$attendance,'cancelled'=>true]);
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    if ($method === 'GET' && preg_match('#^/api/attendance/([0-9]+)/history$#',$path,$matches)) {
        $u=require_user();
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $attendanceId=(int)$matches[1];
        $q=$pdo->prepare('SELECT outlet_id,user_id FROM employee_attendance WHERE id=?'); $q->execute([$attendanceId]); $owner=$q->fetch();
        if(!$owner) json_out(['error'=>'Catatan absensi tidak ditemukan.'],404);
        if($u['role']!=='owner' && (int)$u['id']!==(int)$owner['user_id']) json_out(['error'=>'Anda tidak memiliki akses ke riwayat absensi ini.'],403);
        if($u['role']==='owner' && (int)$owner['outlet_id']!==$ownerOutletId()) json_out(['error'=>'Anda tidak memiliki akses ke riwayat absensi ini.'],403);
        $q=$pdo->prepare("SELECT e.id,e.event_type,e.reason,e.occurred_at,e.attendance_time_before,e.attendance_time_after,e.latitude,e.longitude,e.accuracy_meters,
            CASE WHEN e.photo_storage_key IS NOT NULL AND e.photo_expires_at>NOW() THEN TRUE ELSE FALSE END AS photo_available,u.name AS actor
            FROM attendance_events e JOIN users u ON u.id=e.actor_user_id WHERE e.attendance_id=? ORDER BY e.occurred_at,e.id");
        $q->execute([$attendanceId]); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method==='GET' && preg_match('#^/api/attendance/events/([0-9]+)/photo$#',$path,$matches)) {
        $u=require_user(); $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $q=$pdo->prepare("SELECT e.photo_storage_key,e.photo_mime,a.user_id,a.outlet_id FROM attendance_events e JOIN employee_attendance a ON a.id=e.attendance_id WHERE e.id=? AND e.photo_storage_key IS NOT NULL AND e.photo_expires_at>NOW()");
        $q->execute([(int)$matches[1]]); $photo=$q->fetch();
        if(!$photo) json_out(['error'=>'Selfie tidak ditemukan atau masa simpannya telah berakhir.'],404);
        if($u['role']!=='owner' && ((int)$u['id']!==(int)$photo['user_id'] || $u['role']!=='karyawan')) json_out(['error'=>'Anda tidak memiliki akses ke selfie ini.'],403);
        if($u['role']==='owner' && (int)$photo['outlet_id']!==$ownerOutletId()) json_out(['error'=>'Anda tidak memiliki akses ke selfie ini.'],403);
        if(!preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/',(string)$photo['photo_storage_key'])) json_out(['error'=>'Kunci penyimpanan selfie tidak valid.'],500);
        $photoPath=$attendancePhotoDirectory().'/'.$photo['photo_storage_key'];
        if(!is_file($photoPath) || is_link($photoPath)) json_out(['error'=>'Berkas selfie tidak tersedia.'],404);
        header('Content-Type: '.$photo['photo_mime']); header('Content-Length: '.(string)filesize($photoPath));
        header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store, max-age=0');
        readfile($photoPath); exit;
    }
    if ($method==='PATCH' && preg_match('#^/api/owner/attendance/([0-9]+)$#',$path,$matches)) {
        require_csrf(); $u=require_user('owner'); $input=body(); $reason=trim((string)($input['reason']??'')); $corrected=$input['check_out_at']??'';
        if($reason==='' || strlen($reason)>500 || !is_string($corrected)) json_out(['error'=>'Waktu koreksi dan alasan wajib diisi.'],422);
        try { $correctedAt=new DateTimeImmutable($corrected); } catch(Throwable) { json_out(['error'=>'Format waktu koreksi tidak valid.'],422); }
        $pdo=db(); if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503); $pdo->beginTransaction();
        try {
            $q=$pdo->prepare("SELECT id,outlet_id,user_id,check_in_at,check_out_at FROM employee_attendance WHERE id=? FOR UPDATE");
            $q->execute([(int)$matches[1]]); $attendance=$q->fetch();
            if(!$attendance || (int)$attendance['outlet_id']!==$ownerOutletId()) { $pdo->rollBack(); json_out(['error'=>'Catatan absensi tidak ditemukan pada outlet ini.'],404); }
            if(!$attendance['check_out_at'] || new DateTimeImmutable((string)$attendance['check_out_at'])>=new DateTimeImmutable('now')->modify('-2 minutes')) {
                $pdo->rollBack(); json_out(['error'=>'Koreksi Owner hanya tersedia setelah jendela pembatalan 2 menit berakhir.'],409);
            }
            if($correctedAt<new DateTimeImmutable((string)$attendance['check_in_at']) || $correctedAt>new DateTimeImmutable('now')) {
                $pdo->rollBack(); json_out(['error'=>'Waktu pulang harus berada setelah waktu masuk dan tidak boleh di masa depan.'],422);
            }
            $q=$pdo->prepare('UPDATE employee_attendance SET check_out_at=? WHERE id=? RETURNING id,work_date,shift_type,check_in_at,check_out_at,checkout_reason,status');
            $q->execute([$correctedAt->format(DateTimeInterface::ATOM),(int)$attendance['id']]); $updated=$q->fetch();
            $q=$pdo->prepare("INSERT INTO attendance_events(attendance_id,actor_user_id,event_type,reason,attendance_time_before,attendance_time_after) VALUES(?,?,'owner_correction',?,?,?)");
            $q->execute([(int)$attendance['id'],(int)$u['id'],$reason,$attendance['check_out_at'],$updated['check_out_at']]);
            $pdo->commit(); json_out(['attendance'=>$updated]);
        } catch(Throwable $error) {
            if($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    if ($method === 'GET' && $path === '/api/owner/employees') {
        require_user('owner');
        $outletId=$ownerOutletId();
        $q=db()->prepare("SELECT id,name,username,email,is_active,created_at FROM users WHERE outlet_id=? AND role='karyawan' ORDER BY name,id");
        $q->execute([$outletId]);
        json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'POST' && $path === '/api/owner/employees') {
        require_csrf();
        require_user('owner');
        $input=body();
        $name=trim((string)($input['name']??''));
        $username=trim((string)($input['username']??''));
        $email=strtolower(trim((string)($input['email']??'')));
        $password=(string)($input['password']??'');
        $nameLength=preg_match_all('/./us',$name);
        $passwordLength=preg_match_all('/./us',$password);
        if ($name==='' || $nameLength===false || $nameLength>100 || !preg_match('/^[A-Za-z0-9._-]{3,50}$/',$username)) {
            json_out(['error'=>'Nama wajib diisi (maksimal 100 karakter) dan nama pengguna harus 3–50 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.'],422);
        }
        if ($email!=='' && (strlen($email)>100 || !filter_var($email,FILTER_VALIDATE_EMAIL))) {
            json_out(['error'=>'Format email tidak valid.'],422);
        }
        if ($passwordLength===false || $passwordLength<12 || $passwordLength>128 || str_contains($password,"\0")) {
            json_out(['error'=>'Kata sandi awal harus terdiri dari 12–128 karakter.'],422);
        }
        $outletId=$ownerOutletId();
        $identities=[$username];
        if ($email!=='') $identities[]=$email;
        $identitySlots=implode(',',array_fill(0,count($identities),'LOWER(?)'));
        $q=db()->prepare("SELECT 1 FROM users WHERE LOWER(username) IN ({$identitySlots}) OR LOWER(email) IN ({$identitySlots}) LIMIT 1");
        $q->execute([...$identities,...$identities]);
        if ($q->fetchColumn()) json_out(['error'=>'Nama pengguna atau email sudah digunakan.'],409);
        try {
            $q=db()->prepare("INSERT INTO users(outlet_id,name,username,email,password_hash,role,is_active) VALUES(?,?,?,?,?,'karyawan',TRUE) RETURNING id,name,username,email,role,is_active,created_at");
            $q->execute([$outletId,$name,$username,$email?:null,password_hash($password,PASSWORD_DEFAULT)]);
            json_out(['user'=>$q->fetch()],201);
        } catch (PDOException $error) {
            if ($error->getCode()==='23505') json_out(['error'=>'Nama pengguna atau email sudah digunakan.'],409);
            throw $error;
        }
    }
    if ($method === 'GET' && $path === '/api/attendance') {
        require_user('owner');
        $pdo=db();
        if(!$attendanceSafeguardsReady($pdo)) json_out(['error'=>'Migration pengaman absensi belum diterapkan.'],503);
        $outletId=$ownerOutletId();
        $date=$_GET['date']??(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('Y-m-d');
        $search=trim((string)($_GET['search']??'')); $shift=$_GET['shift']??'';
        if($shift!==''&&!in_array($shift,['pagi','siang','sore','malam'],true))json_out(['error'=>'Jenis shift tidak valid.'],422);
        $q=$pdo->prepare("SELECT u.id AS user_id,a.id AS attendance_id,a.work_date,a.check_in_at,a.check_out_at,a.checkout_reason,a.status,u.name,u.role,COALESCE(a.shift_type,s.shift_type) AS shift_type,
            (SELECT COUNT(*) FROM attendance_events ev WHERE ev.attendance_id=a.id AND ev.event_type='checkout_cancelled') AS cancellation_count,
            (SELECT MAX(ev.occurred_at) FROM attendance_events ev WHERE ev.attendance_id=a.id) AS last_event_at
            FROM users u LEFT JOIN employee_attendance a ON a.user_id=u.id AND a.work_date=?::date LEFT JOIN shifts s ON s.id=a.shift_id
            WHERE u.outlet_id=? AND u.is_active=TRUE AND u.role IN ('kasir','karyawan') AND LOWER(u.name) LIKE LOWER(?) AND (?::text IS NULL OR COALESCE(a.shift_type,s.shift_type)=?)
            ORDER BY u.name,a.check_in_at DESC NULLS LAST LIMIT 300");
        $q->execute([$date,$outletId,'%'.$search.'%',$shift?:null,$shift?:null]); $items=$q->fetchAll();
        $employeeRows=[]; foreach($items as $row){$employeeRows[(int)$row['user_id']][]=$row;}
        $present=0;$notCheckedIn=0;$leave=0;
        foreach($employeeRows as $records) {
            if(count(array_filter($records,static fn(array $row):bool=>$row['status']==='hadir'))>0)$present++;
            if(count(array_filter($records,static fn(array $row):bool=>$row['attendance_id']===null))>0)$notCheckedIn++;
            if(count(array_filter($records,static fn(array $row):bool=>in_array($row['status'],['izin','sakit','alpha'],true)))>0)$leave++;
        }
        json_out(['items'=>$items,'summary'=>['employees'=>count($employeeRows),'present'=>$present,'not_checked_in'=>$notCheckedIn,'leave'=>$leave]]);
    }
    if ($method === 'GET' && $path === '/api/owner/dashboard') {
        require_user('owner'); $outletId=$ownerOutletId(); [$start,$end,$period]=$ownerDateRange(); $from=$start->format('Y-m-d H:i:sP'); $until=$end->format('Y-m-d H:i:sP');
        $q=db()->prepare("SELECT COUNT(*) AS paid_transactions,COALESCE(SUM(total),0) AS revenue FROM transactions WHERE outlet_id=? AND payment_status='lunas' AND status='aktif' AND created_at>=? AND created_at<?"); $q->execute([$outletId,$from,$until]); $summary=$q->fetch();
        $q=db()->prepare("SELECT p.payment_method,COALESCE(SUM(p.amount),0) AS amount FROM payments p JOIN transactions t ON t.id=p.transaction_id WHERE t.outlet_id=? AND t.status='aktif' AND p.paid_at>=? AND p.paid_at<? GROUP BY p.payment_method"); $q->execute([$outletId,$from,$until]); $payments=['tunai'=>0,'qris'=>0]; foreach($q->fetchAll() as $payment){$payments[$payment['payment_method']]=(float)$payment['amount'];}
        $q=db()->prepare("SELECT lo.status,COUNT(*) AS count FROM laundry_orders lo JOIN transactions t ON t.id=lo.transaction_id WHERE t.outlet_id=? GROUP BY lo.status"); $q->execute([$outletId]); $orders=$q->fetchAll();
        $q=db()->prepare("SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS date,COALESCE(SUM(total),0) AS revenue FROM transactions WHERE outlet_id=? AND payment_status='lunas' AND status='aktif' AND created_at>=? AND created_at<? GROUP BY date ORDER BY date"); $q->execute([$outletId,$from,$until]); $chart=$q->fetchAll();
        $q=db()->prepare("SELECT transaction_number,transaction_type,payment_status,total,created_at FROM transactions WHERE outlet_id=? AND status='aktif' AND created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 8"); $q->execute([$outletId,$from,$until]); $recent=$q->fetchAll();
        $q=db()->prepare("SELECT COUNT(*) FROM employee_attendance WHERE outlet_id=? AND work_date=(NOW() AT TIME ZONE 'Asia/Jakarta')::date AND status='hadir'"); $q->execute([$outletId]); $attendance=(int)$q->fetchColumn();
        $q=db()->prepare("SELECT ti.description AS name,COALESCE(SUM(ti.subtotal),0) AS revenue FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id WHERE t.outlet_id=? AND ti.item_type='service' AND t.payment_status='lunas' AND t.status='aktif' AND t.created_at>=? AND t.created_at<? GROUP BY ti.description ORDER BY revenue DESC LIMIT 5"); $q->execute([$outletId,$from,$until]); $topServices=$q->fetchAll();
        $q=db()->query("SELECT COUNT(*) AS product_count,COUNT(*) FILTER(WHERE stock<=minimum_stock) AS low_stock_count FROM products WHERE is_active"); $inventorySummary=$q->fetch();
        $q=db()->query("SELECT id,name,category,stock,minimum_stock,unit FROM products WHERE is_active ORDER BY (stock<=minimum_stock) DESC,name LIMIT 10"); $inventory=$q->fetchAll();
        $q=db()->query('SELECT id,name,stock,description FROM coin_types WHERE is_active ORDER BY id'); $coins=$q->fetchAll();
        $q=db()->prepare("SELECT COALESCE(SUM(cm.quantity),0) FROM coin_movements cm JOIN shifts s ON s.id=cm.shift_id WHERE s.outlet_id=? AND cm.created_at>=? AND cm.created_at<? AND (cm.direction='keluar' OR (cm.direction IS NULL AND cm.movement_type='keluar'))");
        $q->execute([$outletId,$from,$until]); $coinUsage=$q->fetchColumn();
        $q=db()->prepare("SELECT s.id,s.shift_type,s.started_at,s.ended_at,s.status,u.name AS cashier,
            COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.shift_id=s.id),0) AS received_total
            FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.outlet_id=? ORDER BY s.started_at DESC LIMIT 8"); $q->execute([$outletId]); $recentShifts=$q->fetchAll();
        json_out(['period'=>$period,'from'=>$start->format('Y-m-d'),'to'=>$end->modify('-1 day')->format('Y-m-d'),'summary'=>$summary,'payments'=>$payments,'orders'=>$orders,'chart'=>$chart,'recent'=>$recent,'attendance_today'=>$attendance,'top_services'=>$topServices,'inventory_summary'=>$inventorySummary,'inventory'=>$inventory,'coins'=>$coins,'coin_usage'=>$coinUsage,'recent_shifts'=>$recentShifts]);
    }
    if ($method === 'GET' && $path === '/api/owner/finance') {
        require_user('owner'); $outletId=$ownerOutletId(); [$start,$end,$period]=$ownerDateRange(); $from=$start->format('Y-m-d H:i:sP'); $until=$end->format('Y-m-d H:i:sP');
        $paymentMethod=$_GET['payment_method']??''; if($paymentMethod&&!in_array($paymentMethod,['tunai','qris'],true))json_out(['error'=>'Metode pembayaran tidak valid.'],422);
        $paymentStatus=$_GET['payment_status']??''; if($paymentStatus&&!in_array($paymentStatus,['lunas','belum_bayar'],true))json_out(['error'=>'Status pembayaran tidak valid.'],422);
        $expenseCategory=$_GET['expense_category']??'';
        $expenseCategories=['Pembelian sabun','Pembelian pewangi','Pembelian gas','Perawatan mesin','Pembelian stok lainnya','Pengeluaran operasional lainnya'];
        if($expenseCategory&&!in_array($expenseCategory,$expenseCategories,true))json_out(['error'=>'Kategori pengeluaran tidak valid.'],422);
        $search=trim((string)($_GET['search']??'')); $where="t.outlet_id=? AND t.created_at>=? AND t.created_at<? AND t.status='aktif' AND (?::text IS NULL OR COALESCE(t.payment_method,p.payment_method)=?) AND (?::text IS NULL OR t.payment_status=?) AND (?::text IS NULL OR t.transaction_number ILIKE ? OR c.name ILIKE ?)";
        $params=[$outletId,$from,$until,$paymentMethod?:null,$paymentMethod?:null,$paymentStatus?:null,$paymentStatus?:null,$search?:null,'%'.$search.'%','%'.$search.'%'];
        $q=db()->prepare("SELECT COUNT(*) FROM transactions t LEFT JOIN payments p ON p.transaction_id=t.id LEFT JOIN customers c ON c.id=t.customer_id WHERE {$where}"); $q->execute($params); $total=(int)$q->fetchColumn();
        $q=db()->prepare("SELECT t.transaction_number,t.transaction_type,t.total,t.payment_status,t.created_at,c.name AS customer,COALESCE(t.payment_method,p.payment_method) AS payment_method,p.amount AS paid_amount,p.paid_at FROM transactions t LEFT JOIN payments p ON p.transaction_id=t.id LEFT JOIN customers c ON c.id=t.customer_id WHERE {$where} ORDER BY t.created_at DESC LIMIT 200"); $q->execute($params); $items=$q->fetchAll();
        $q=db()->prepare("SELECT COALESCE(SUM(t.total),0) FROM transactions t LEFT JOIN payments p ON p.transaction_id=t.id LEFT JOIN customers c ON c.id=t.customer_id WHERE {$where} AND t.payment_status='lunas'");
        $q->execute($params); $revenue=(float)$q->fetchColumn();
        $receivedWhere="t.outlet_id=? AND t.status='aktif' AND p.paid_at>=? AND p.paid_at<? AND (?::text IS NULL OR p.payment_method=?) AND (?::text IS NULL OR t.payment_status=?) AND (?::text IS NULL OR t.transaction_number ILIKE ? OR c.name ILIKE ?)";
        $receivedParams=[$outletId,$from,$until,$paymentMethod?:null,$paymentMethod?:null,$paymentStatus?:null,$paymentStatus?:null,$search?:null,'%'.$search.'%','%'.$search.'%'];
        $q=db()->prepare("SELECT COALESCE(SUM(p.amount),0) AS received,COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='tunai'),0) AS cash,COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='qris'),0) AS qris FROM payments p JOIN transactions t ON t.id=p.transaction_id LEFT JOIN customers c ON c.id=t.customer_id WHERE {$receivedWhere}");
        $q->execute($receivedParams); $payments=$q->fetch();
        $expensesReady=$expenseLedgerReady();
        $expenseSummary=['expenses'=>null,'cash_expenses'=>null,'bank_expenses'=>null]; $expenses=[];
        if($expensesReady) {
            $expenseWhere="e.outlet_id=? AND e.created_at>=? AND e.created_at<? AND (?::text IS NULL OR e.payment_method=?) AND (?::text IS NULL OR e.category=?) AND (?::text IS NULL OR e.expense_number ILIKE ? OR e.description ILIKE ? OR e.category ILIKE ?)";
            $expenseParams=[$outletId,$from,$until,$paymentMethod?:null,$paymentMethod?:null,$expenseCategory?:null,$expenseCategory?:null,$search?:null,'%'.$search.'%','%'.$search.'%','%'.$search.'%'];
            $q=db()->prepare("SELECT COALESCE(SUM(e.amount),0) AS expenses,COALESCE(SUM(e.amount) FILTER(WHERE e.funding_source='laci_kas'),0) AS cash_expenses,COALESCE(SUM(e.amount) FILTER(WHERE e.funding_source='rekening_usaha'),0) AS bank_expenses FROM expenses e WHERE {$expenseWhere}");
            $q->execute($expenseParams); $expenseSummary=$q->fetch();
            $q=db()->prepare("SELECT e.id,e.expense_number,e.category,e.amount,e.description,e.payment_method,e.funding_source,e.shift_id,e.created_at,u.name AS operator,e.receipt_storage_key FROM expenses e JOIN users u ON u.id=e.recorded_by WHERE {$expenseWhere} ORDER BY e.created_at DESC,e.id DESC LIMIT 200");
            $q->execute($expenseParams); $expenses=$q->fetchAll();
        }
        foreach($expenses as &$expense) { $expense['receipt_url']='/api/expenses/'.(int)$expense['id'].'/receipt'; unset($expense['receipt_storage_key']); }
        unset($expense);
        $summary=[
            'revenue'=>$revenue,
            'received'=>(float)$payments['received'],
            'cash'=>(float)$payments['cash'],
            'qris'=>(float)$payments['qris'],
            'expenses'=>(float)$expenseSummary['expenses'],
            'cash_expenses'=>(float)$expenseSummary['cash_expenses'],
            'bank_expenses'=>(float)$expenseSummary['bank_expenses'],
            'net_cash_flow'=>$expensesReady?(float)$payments['received']-(float)$expenseSummary['expenses']:null,
        ];
        if(!$expensesReady) { $summary['expenses']=null; $summary['cash_expenses']=null; $summary['bank_expenses']=null; }
        json_out(['period'=>$period,'from'=>$start->format('Y-m-d'),'to'=>$end->modify('-1 day')->format('Y-m-d'),'items'=>$items,'expenses'=>$expenses,'total'=>$total,'summary'=>$summary,'expense_ledger_ready'=>$expensesReady,'date_basis'=>['revenue'=>'transactions.created_at','received'=>'payments.paid_at','expenses'=>'expenses.created_at']]);
    }
    if ($method === 'GET' && preg_match('#^/api/expenses/([0-9]+)$#',$path,$matches)) {
        $u=require_user();
        if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke pengeluaran.'],403);
        if(!$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan.'],503);
        $outletId=$u['role']==='owner'?$ownerOutletId():(int)$u['outlet_id'];
        $q=db()->prepare('SELECT e.id,e.expense_number,e.category,e.amount,e.description,e.payment_method,e.funding_source,e.shift_id,e.created_at,e.updated_at,e.recorded_by,u.name AS operator FROM expenses e JOIN users u ON u.id=e.recorded_by WHERE e.id=? AND e.outlet_id=?');
        $q->execute([(int)$matches[1],$outletId]); $expense=$q->fetch();
        if(!$expense || ($u['role']==='kasir' && (int)$expense['recorded_by']!==(int)$u['id'])) json_out(['error'=>'Pengeluaran tidak ditemukan.'],404);
        $q=db()->prepare('SELECT a.id,a.changed_by,u.name AS operator,a.change_reason,a.old_values,a.new_values,a.created_at FROM expense_audit a JOIN users u ON u.id=a.changed_by WHERE a.expense_id=? ORDER BY a.created_at DESC,a.id DESC');
        $q->execute([(int)$expense['id']]); $audit=$q->fetchAll();
        foreach($audit as &$entry) {
            $entry['old_values']=json_decode((string)$entry['old_values'],true);
            $entry['new_values']=json_decode((string)$entry['new_values'],true);
        }
        unset($entry);
        json_out(['expense'=>$expense,'audit'=>$audit]);
    }
    if ($method === 'GET' && preg_match('#^/api/expenses/([0-9]+)/receipt$#',$path,$matches)) {
        $u=require_user();
        if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke bukti pengeluaran.'],403);
        if(!$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan.'],503);
        $outletId=$u['role']==='owner'?$ownerOutletId():(int)$u['outlet_id'];
        $sql='SELECT id,recorded_by,receipt_storage_key,receipt_mime FROM expenses WHERE id=? AND outlet_id=?';
        $q=db()->prepare($sql); $q->execute([(int)$matches[1],$outletId]); $expense=$q->fetch();
        if (!$expense || ($u['role']==='kasir' && (int)$expense['recorded_by']!==(int)$u['id'])) json_out(['error'=>'Bukti pengeluaran tidak ditemukan.'],404);
        $key=(string)$expense['receipt_storage_key'];
        if (!preg_match('/^[a-f0-9]{48}\.(jpg|png|webp|pdf)$/',$key)) json_out(['error'=>'Referensi bukti pengeluaran tidak valid.'],500);
        $file=dirname(__DIR__).'/private/expenses/'.$key;
        if (!is_file($file) || !is_readable($file)) json_out(['error'=>'Berkas bukti pengeluaran tidak ditemukan.'],404);
        header('Content-Type: '.$expense['receipt_mime']);
        header('Content-Length: '.(string)filesize($file));
        header('Content-Disposition: attachment; filename="bukti-pengeluaran-'.(int)$expense['id'].'"');
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        readfile($file);
        exit;
    }
    if ($method === 'GET' && $path === '/api/expenses') {
        $u=require_user();
        if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke pengeluaran.'],403);
        if(!$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan.'],503);
        $outletId=$u['role']==='owner'?$ownerOutletId():(int)$u['outlet_id'];
        $where=['e.outlet_id=?']; $params=[$outletId];
        foreach(['from','to'] as $dateKey) {
            $date=$_GET[$dateKey]??'';
            if ($date==='') continue;
            $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Asia/Jakarta'));
            if (!$parsed || $parsed->format('Y-m-d')!==$date) json_out(['error'=>'Tanggal filter pengeluaran tidak valid.'],422);
            $where[]=$dateKey==='from'?'e.created_at>=?':'e.created_at<?';
            if($dateKey==='to') $parsed=$parsed->modify('+1 day');
            $params[]=$parsed->format('Y-m-d H:i:sP');
        }
        if($u['role']==='kasir') { $where[]='e.recorded_by=?'; $params[]=(int)$u['id']; }
        $whereSql=implode(' AND ',$where); $limit=min(200,max(1,(int)($_GET['limit']??100)));
        $q=db()->prepare("SELECT e.id,e.expense_number,e.category,e.amount,e.description,e.payment_method,e.funding_source,e.shift_id,e.created_at,u.name AS operator,e.receipt_storage_key FROM expenses e JOIN users u ON u.id=e.recorded_by WHERE {$whereSql} ORDER BY e.created_at DESC,e.id DESC LIMIT ?");
        $q->execute([...$params,$limit]); $items=$q->fetchAll();
        foreach($items as &$item) { $item['receipt_url']='/api/expenses/'.(int)$item['id'].'/receipt'; unset($item['receipt_storage_key']); }
        unset($item);
        $activeShifts=[];
        if($u['role']==='owner') {
            $q=db()->prepare("SELECT s.id,s.shift_type,s.started_at,u.name AS cashier FROM shifts s JOIN users u ON u.id=s.user_id WHERE s.outlet_id=? AND s.status='open' ORDER BY s.started_at DESC");
            $q->execute([$outletId]); $activeShifts=$q->fetchAll();
        } else {
            $q=db()->prepare("SELECT id,shift_type,started_at FROM shifts WHERE user_id=? AND outlet_id=? AND status='open' ORDER BY started_at DESC LIMIT 1");
            $q->execute([(int)$u['id'],$outletId]); $shift=$q->fetch(); if($shift) $activeShifts=[$shift];
        }
        json_out(['items'=>$items,'active_shifts'=>$activeShifts]);
    }
    if ($method === 'POST' && $path === '/api/expenses') {
        require_csrf(); $u=require_user();
        if (!in_array($u['role'],['owner','kasir'],true)) json_out(['error'=>'Anda tidak memiliki akses ke pengeluaran.'],403);
        if(!$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan. Pengeluaran belum dapat disimpan.'],503);
        $outletId=$u['role']==='owner'?$ownerOutletId():(int)$u['outlet_id'];
        if(!$outletId) json_out(['error'=>'Akun belum ditautkan ke outlet.'],422);
        $categories=['Pembelian sabun','Pembelian pewangi','Pembelian gas','Perawatan mesin','Pembelian stok lainnya','Pengeluaran operasional lainnya'];
        $category=trim((string)($_POST['category']??''));
        $description=trim((string)($_POST['description']??''));
        $amountInput=$_POST['amount']??null; $methodExpense=$_POST['payment_method']??'';
        $fundingSource=$_POST['funding_source']??'';
        $key=trim((string)($_POST['idempotency_key']??''));
        $descriptionLength=preg_match_all('/./us',$description);
        if(!in_array($category,$categories,true) || !is_numeric($amountInput) || !is_finite((float)$amountInput) || (float)$amountInput<=0 || (float)$amountInput>9999999999.99 || $description==='' || $descriptionLength===false || $descriptionLength>500 || !in_array($methodExpense,['tunai','qris'],true) || !preg_match('/^[A-Za-z0-9._:-]{8,100}$/',$key)) json_out(['error'=>'Kategori, nominal, keterangan, metode, atau kunci pengeluaran tidak valid.'],422);
        $expectedSource=$methodExpense==='tunai'?'laci_kas':'rekening_usaha';
        if($fundingSource!==$expectedSource) json_out(['error'=>'Sumber dana tidak sesuai dengan metode pembayaran.'],422);
        $file=$_FILES['receipt']??null;
        if(!$file || !isset($file['error']) || $file['error']!==UPLOAD_ERR_OK) json_out(['error'=>'Bukti pengeluaran wajib diunggah.'],422);
        if((int)$file['size']<=0 || (int)$file['size']>5242880 || !is_uploaded_file((string)$file['tmp_name'])) json_out(['error'=>'Bukti harus berukuran maksimal 5 MB.'],422);
        $finfo=finfo_open(FILEINFO_MIME_TYPE);
        if($finfo===false) json_out(['error'=>'Validasi tipe bukti tidak tersedia pada server.'],500);
        $mime=finfo_file($finfo,(string)$file['tmp_name']); finfo_close($finfo);
        $extensions=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','application/pdf'=>'pdf'];
        if(!is_string($mime) || !isset($extensions[$mime])) json_out(['error'=>'Format bukti harus JPG, PNG, WebP, atau PDF.'],422);
        $receiptHash=hash_file('sha256',(string)$file['tmp_name']);
        if(!is_string($receiptHash)) json_out(['error'=>'Bukti tidak dapat dibaca oleh server.'],422);
        $amount=round((float)$amountInput,2);
        $requestHash=hash('sha256',json_encode(['category'=>$category,'amount'=>$amount,'description'=>$description,'payment_method'=>$methodExpense,'funding_source'=>$fundingSource,'receipt_hash'=>$receiptHash],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
        $pdo=db();
        $q=$pdo->prepare('SELECT id,expense_number,request_hash FROM expenses WHERE outlet_id=? AND idempotency_key=?');
        $q->execute([$outletId,$key]); $duplicate=$q->fetch();
        if($duplicate) {
            if(!hash_equals(trim((string)$duplicate['request_hash']),$requestHash)) json_out(['error'=>'Kunci pengeluaran sudah digunakan dengan data berbeda.'],409);
            json_out(['ok'=>true,'duplicate'=>true,'expense'=>['id'=>(int)$duplicate['id'],'expense_number'=>$duplicate['expense_number']]]);
        }
        $shiftId=null;
        if($u['role']==='kasir') {
            $pdo->beginTransaction();
            $q=$pdo->prepare("SELECT id FROM shifts WHERE user_id=? AND outlet_id=? AND status='open' FOR UPDATE");
            $q->execute([(int)$u['id'],$outletId]); $shift=$q->fetch();
            if(!$shift) { $pdo->rollBack(); json_out(['error'=>'Buka shift sebelum mencatat pengeluaran.'],409); }
            $shiftId=(int)$shift['id'];
        } elseif(!empty($_POST['shift_id'])) {
            $requestedShift=filter_var($_POST['shift_id'],FILTER_VALIDATE_INT);
            if(!$requestedShift) json_out(['error'=>'Shift pengeluaran tidak valid.'],422);
            $pdo->beginTransaction();
            $q=$pdo->prepare("SELECT id FROM shifts WHERE id=? AND outlet_id=? AND status='open' FOR UPDATE");
            $q->execute([$requestedShift,$outletId]); $activeShift=$q->fetch();
            if(!$activeShift) { $pdo->rollBack(); json_out(['error'=>'Shift tidak aktif atau bukan milik outlet ini.'],409); }
            $shiftId=(int)$activeShift['id'];
        }
        $directory=dirname(__DIR__).'/private/expenses';
        if(is_link(dirname(__DIR__).'/private') || is_link($directory)) { if($pdo->inTransaction()) $pdo->rollBack(); json_out(['error'=>'Lokasi penyimpanan bukti tidak aman.'],500); }
        if(!is_dir($directory) && !mkdir($directory,0700,true) && !is_dir($directory)) { if($pdo->inTransaction()) $pdo->rollBack(); json_out(['error'=>'Direktori bukti pengeluaran tidak dapat disiapkan.'],500); }
        $storageKey=bin2hex(random_bytes(24)).'.'.$extensions[$mime];
        $storedPath=$directory.'/'.$storageKey;
        if(!move_uploaded_file((string)$file['tmp_name'],$storedPath)) { if($pdo->inTransaction()) $pdo->rollBack(); json_out(['error'=>'Bukti pengeluaran gagal disimpan.'],500); }
        $cleanupReceipt=static function() use ($storedPath): void {
            if(is_file($storedPath) && !unlink($storedPath)) error_log('KINO POS: gagal membersihkan bukti expense '.$storedPath);
        };
        try {
            if(!$pdo->inTransaction()) $pdo->beginTransaction();
            $nextId=(int)$pdo->query("SELECT nextval(pg_get_serial_sequence('expenses','id'))")->fetchColumn();
            $number='KINO-EXP-'.(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('ymd').'-'.str_pad((string)$nextId,8,'0',STR_PAD_LEFT);
            $q=$pdo->prepare('INSERT INTO expenses(id,outlet_id,expense_number,category,amount,description,payment_method,funding_source,shift_id,recorded_by,receipt_storage_key,receipt_mime,receipt_size,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id,expense_number,category,amount,description,payment_method,funding_source,shift_id,created_at');
            $q->execute([$nextId,$outletId,$number,$category,$amount,$description,$methodExpense,$fundingSource,$shiftId,(int)$u['id'],$storageKey,$mime,(int)$file['size'],$key,$requestHash]);
            $expense=$q->fetch(); $pdo->commit();
            json_out(['ok'=>true,'duplicate'=>false,'expense'=>$expense],201);
        } catch(PDOException $e) {
            if($pdo->inTransaction()) $pdo->rollBack();
            $cleanupReceipt();
            if($e->getCode()==='23505') {
                $q=$pdo->prepare('SELECT id,expense_number,request_hash FROM expenses WHERE outlet_id=? AND idempotency_key=?');
                $q->execute([$outletId,$key]); $duplicate=$q->fetch();
                if($duplicate && hash_equals(trim((string)$duplicate['request_hash']),$requestHash)) json_out(['ok'=>true,'duplicate'=>true,'expense'=>['id'=>(int)$duplicate['id'],'expense_number'=>$duplicate['expense_number']]]);
                if($duplicate) json_out(['error'=>'Kunci pengeluaran sudah digunakan dengan data berbeda.'],409);
            }
            throw $e;
        } catch(Throwable $e) {
            if($pdo->inTransaction()) $pdo->rollBack();
            $cleanupReceipt();
            throw $e;
        }
    }
    if ($method === 'PATCH' && preg_match('#^/api/expenses/([0-9]+)$#',$path,$matches)) {
        require_csrf(); $u=require_user('owner'); $outletId=$ownerOutletId(); $i=body();
        if(!$expenseLedgerReady()) json_out(['error'=>'Migration ledger pengeluaran belum diterapkan.'],503);
        $categories=['Pembelian sabun','Pembelian pewangi','Pembelian gas','Perawatan mesin','Pembelian stok lainnya','Pengeluaran operasional lainnya'];
        $category=trim((string)($i['category']??'')); $description=trim((string)($i['description']??''));
        $amount=$i['amount']??null; $paymentMethod=$i['payment_method']??''; $fundingSource=$i['funding_source']??'';
        $reason=trim((string)($i['change_reason']??''));
        if(!in_array($category,$categories,true) || !is_numeric($amount) || !is_finite((float)$amount) || (float)$amount<=0 || (float)$amount>9999999999.99 || $description==='' || strlen($description)>500 || !in_array($paymentMethod,['tunai','qris'],true) || $fundingSource!==($paymentMethod==='tunai'?'laci_kas':'rekening_usaha') || $reason==='' || strlen($reason)>500) json_out(['error'=>'Perubahan dan alasan koreksi wajib valid.'],422);
        $newValues=['category'=>$category,'amount'=>round((float)$amount,2),'description'=>$description,'payment_method'=>$paymentMethod,'funding_source'=>$fundingSource];
        $pdo=db(); $pdo->beginTransaction();
        $q=$pdo->prepare('SELECT id,category,amount,description,payment_method,funding_source FROM expenses WHERE id=? AND outlet_id=? FOR UPDATE');
        $q->execute([(int)$matches[1],$outletId]); $expense=$q->fetch();
        if(!$expense) { $pdo->rollBack(); json_out(['error'=>'Pengeluaran tidak ditemukan.'],404); }
        $oldValues=['category'=>$expense['category'],'amount'=>(float)$expense['amount'],'description'=>$expense['description'],'payment_method'=>$expense['payment_method'],'funding_source'=>$expense['funding_source']];
        if($oldValues===$newValues) { $pdo->commit(); json_out(['ok'=>true,'unchanged'=>true]); }
        $q=$pdo->prepare('UPDATE expenses SET category=?,amount=?,description=?,payment_method=?,funding_source=?,updated_at=NOW() WHERE id=?');
        $q->execute([$newValues['category'],$newValues['amount'],$newValues['description'],$newValues['payment_method'],$newValues['funding_source'],$expense['id']]);
        $q=$pdo->prepare('INSERT INTO expense_audit(expense_id,changed_by,change_reason,old_values,new_values) VALUES(?,?,?,?::jsonb,?::jsonb)');
        $q->execute([$expense['id'],(int)$u['id'],$reason,json_encode($oldValues,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),json_encode($newValues,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
        $pdo->commit(); json_out(['ok'=>true]);
    }
    if ($method === 'GET' && $path === '/api/owner/services') {
        require_user('owner'); $q=db()->query("SELECT s.id,s.code,s.name,s.category,s.pricing_unit,s.base_price,s.is_active,(SELECT sp.price FROM service_prices sp WHERE sp.service_id=s.id AND sp.price_type='malam' AND sp.is_active LIMIT 1) AS night_price FROM services s ORDER BY s.category,s.name"); json_out(['items'=>$q->fetchAll()]);
    }
    if ($method === 'PUT' && $path === '/api/owner/services/price') {
        require_csrf(); require_user('owner'); $input=body(); $id=filter_var($input['service_id']??null,FILTER_VALIDATE_INT); $price=$input['base_price']??null; $night=$input['night_price']??null;
        $maximumPrice=9999999999.99;
        if(!$id||!is_numeric($price)||(float)$price<0||(float)$price>$maximumPrice||($night!==null&&(!is_numeric($night)||(float)$night<0||(float)$night>$maximumPrice)))json_out(['error'=>'Harga layanan tidak valid.'],422);
        $pdo=db(); $pdo->beginTransaction();
        try {
            $q=$pdo->prepare('UPDATE services SET base_price=? WHERE id=? AND is_active=TRUE RETURNING id'); $q->execute([(float)$price,$id]);
            if(!$q->fetch()){ $pdo->rollBack(); json_out(['error'=>'Layanan tidak ditemukan atau tidak aktif.'],404); }
            $q=$pdo->prepare("UPDATE service_prices SET price=? WHERE service_id=? AND price_type='normal' AND is_active=TRUE"); $q->execute([(float)$price,$id]);
            if($night===null){$q=$pdo->prepare("UPDATE service_prices SET is_active=FALSE WHERE service_id=? AND price_type='malam'");$q->execute([$id]);}
            else{$q=$pdo->prepare("INSERT INTO service_prices(service_id,price_type,price,start_time,end_time,is_active) VALUES(?,'malam',?,'23:00','06:00',TRUE) ON CONFLICT(service_id,price_type) DO UPDATE SET price=EXCLUDED.price,is_active=TRUE");$q->execute([$id,(float)$night]);}
            $pdo->commit();
        } catch (Throwable $e) {
            if($pdo->inTransaction())$pdo->rollBack();
            throw $e;
        }
        json_out(['ok'=>true]);
    }
    if ($method === 'GET' && $path === '/api/owner/outlet') {
        require_user('owner'); $pdo=db();
        if($attendanceSafeguardsReady($pdo)) $q=$pdo->query('SELECT id,name,address,phone,attendance_latitude,attendance_longitude,attendance_checkout_grace_minutes FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1');
        else $q=$pdo->query('SELECT id,name,address,phone,NULL::numeric AS attendance_latitude,NULL::numeric AS attendance_longitude,30 AS attendance_checkout_grace_minutes FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1');
        json_out(['outlet'=>$q->fetch()?:null,'attendance_settings_ready'=>$attendanceSafeguardsReady($pdo)]);
    }
    if ($method === 'PUT' && $path === '/api/owner/outlet') {
        require_csrf(); require_user('owner'); $input=body(); $name=trim((string)($input['name']??'')); $address=trim((string)($input['address']??'')); $phone=trim((string)($input['phone']??''));
        $nameLength=preg_match_all('/./us',$name); $addressLength=preg_match_all('/./us',$address); $phoneLength=preg_match_all('/./us',$phone);
        if($name===''||$nameLength===false||$nameLength>100||$addressLength===false||$addressLength>500||$phoneLength===false||$phoneLength>30)json_out(['error'=>'Nama outlet wajib diisi; panjang alamat atau telepon tidak valid.'],422);
        $pdo=db(); $settingsReady=$attendanceSafeguardsReady($pdo);
        if(!$settingsReady&&(array_key_exists('attendance_latitude',$input)||array_key_exists('attendance_longitude',$input)||array_key_exists('attendance_checkout_grace_minutes',$input)))json_out(['error'=>'Migration pengaturan absensi belum diterapkan. Data outlet tidak diubah.'],503);
        if(!$settingsReady) {
            $q=$pdo->prepare('UPDATE outlets SET name=?,address=?,phone=? WHERE id=(SELECT id FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1) RETURNING id,name,address,phone,NULL::numeric AS attendance_latitude,NULL::numeric AS attendance_longitude,30 AS attendance_checkout_grace_minutes');
            $q->execute([$name,$address?:null,$phone?:null]); $outlet=$q->fetch(); if(!$outlet)json_out(['error'=>'Outlet aktif belum tersedia.'],404); json_out(['outlet'=>$outlet,'attendance_settings_ready'=>false]);
        }
        $latitude=trim((string)($input['attendance_latitude']??'')); $longitude=trim((string)($input['attendance_longitude']??''));
        $grace=filter_var($input['attendance_checkout_grace_minutes']??null,FILTER_VALIDATE_INT);
        if(($latitude==='')!==($longitude===''))json_out(['error'=>'Latitude dan longitude lokasi outlet harus diisi bersama.'],422);
        if($latitude!==''&&(!is_numeric($latitude)||!is_finite((float)$latitude)||(float)$latitude < -90||(float)$latitude > 90||!is_numeric($longitude)||!is_finite((float)$longitude)||(float)$longitude < -180||(float)$longitude > 180))json_out(['error'=>'Koordinat lokasi outlet tidak valid.'],422);
        if($grace===false||$grace<0||$grace>240)json_out(['error'=>'Jeda pulang harus berupa bilangan bulat 0–240 menit.'],422);
        $q=$pdo->prepare('UPDATE outlets SET name=?,address=?,phone=?,attendance_latitude=?,attendance_longitude=?,attendance_checkout_grace_minutes=? WHERE id=(SELECT id FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1) RETURNING id,name,address,phone,attendance_latitude,attendance_longitude,attendance_checkout_grace_minutes');
        $q->execute([$name,$address?:null,$phone?:null,$latitude===''?null:(float)$latitude,$longitude===''?null:(float)$longitude,$grace]);
        $outlet=$q->fetch(); if(!$outlet)json_out(['error'=>'Outlet aktif belum tersedia.'],404); json_out(['outlet'=>$outlet,'attendance_settings_ready'=>true]);
    }
    if ($method === 'GET' && $path === '/api/cashier/dashboard') {
        $u=require_user('kasir'); $q=db()->prepare("SELECT id,shift_type,started_at FROM shifts WHERE user_id=? AND status='open' ORDER BY started_at DESC LIMIT 1"); $q->execute([$u['id']]); $shift=$q->fetch();
        if (!$shift) json_out(['shift'=>null,'summary'=>null,'recent'=>[]]);
        $q=db()->prepare("SELECT COUNT(DISTINCT t.id) AS transaction_count,
            COALESCE(SUM(t.total) FILTER(WHERE t.payment_status='lunas'),0) AS paid_total,
            COALESCE(SUM(t.total) FILTER(WHERE t.payment_status='belum_bayar'),0) AS unpaid_total,
            COALESCE(SUM(p.amount),0) AS received_total,
            COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='tunai'),0) AS cash_total,
            COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='qris'),0) AS qris_total
          FROM transactions t LEFT JOIN payments p ON p.transaction_id=t.id
          WHERE t.shift_id=? AND t.status='aktif'");
        $q->execute([$shift['id']]); $summary=$q->fetch();
        $q=db()->prepare("SELECT t.id,t.transaction_number,t.transaction_type,t.total,t.payment_status,COALESCE(t.payment_method,p.payment_method) AS payment_method,t.created_at,c.name AS customer,
            (SELECT string_agg(description,', ' ORDER BY id) FROM transaction_items WHERE transaction_id=t.id) AS items
          FROM transactions t LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN payments p ON p.transaction_id=t.id
          WHERE t.shift_id=? AND t.status='aktif' ORDER BY t.created_at DESC,t.id DESC LIMIT 5");
        $q->execute([$shift['id']]); json_out(['shift'=>$shift,'summary'=>$summary,'recent'=>$q->fetchAll()]);
    }
    if ($method === 'GET' && $path === '/api/shifts/reports') {
        $u=require_user('kasir');
        if (!$u['outlet_id']) json_out(['items'=>[],'total'=>0]);
        $where=['s.outlet_id=?']; $params=[(int)$u['outlet_id']];
        foreach (['from','to'] as $dateKey) {
            $date=$_GET[$dateKey]??'';
            if ($date==='') continue;
            $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Asia/Jakarta'));
            if (!$parsed || $parsed->format('Y-m-d')!==$date) json_out(['error'=>'Tanggal filter tidak valid.'],422);
            $where[]=$dateKey==='from'?"(s.started_at AT TIME ZONE 'Asia/Jakarta')::date>=?::date":"(s.started_at AT TIME ZONE 'Asia/Jakarta')::date<=?::date";
            $params[]=$date;
        }
        $shiftType=$_GET['shift_type']??'';
        if ($shiftType!=='' && !in_array($shiftType,['pagi','siang','sore','malam'],true)) json_out(['error'=>'Jenis shift tidak valid.'],422);
        if ($shiftType!=='') { $where[]='s.shift_type=?'; $params[]=$shiftType; }
        $whereSql=implode(' AND ',$where); $limit=min(100,max(1,(int)($_GET['limit']??50)));
        $pdo=db(); $q=$pdo->prepare("SELECT COUNT(*) FROM shifts s WHERE {$whereSql}"); $q->execute($params); $count=(int)$q->fetchColumn();
        $expenseFields=$expenseLedgerReady()
            ? "(SELECT COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.shift_id=s.id) AS expense_total,
               (SELECT COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.shift_id=s.id AND e.funding_source='laci_kas') AS cash_expense_total,
               (SELECT COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.shift_id=s.id AND e.funding_source='rekening_usaha') AS bank_expense_total"
            : "NULL::numeric AS expense_total,NULL::numeric AS cash_expense_total,NULL::numeric AS bank_expense_total";
        $sql="SELECT s.id,s.shift_type,s.started_at,s.ended_at,s.status,u.name AS cashier,
          (SELECT COUNT(*) FROM transactions t WHERE t.shift_id=s.id AND t.status='aktif') AS transaction_count,
          (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.shift_id=s.id AND t.status='aktif' AND t.payment_status='lunas') AS paid_order_total,
          (SELECT COALESCE(SUM(t.total),0) FROM transactions t WHERE t.shift_id=s.id AND t.status='aktif' AND t.payment_status='belum_bayar') AS unpaid_total,
          (SELECT COUNT(*) FROM transactions t WHERE t.shift_id=s.id AND t.status='aktif' AND t.payment_status='belum_bayar') AS unpaid_count,
          (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.shift_id=s.id) AS received_total,
          (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.shift_id=s.id AND p.payment_method='tunai') AS cash_total,
          (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.shift_id=s.id AND p.payment_method='qris') AS qris_total,
          {$expenseFields},
          (SELECT COALESCE(SUM(cm.quantity) FILTER(WHERE cm.direction='keluar' OR (cm.direction IS NULL AND cm.movement_type='keluar')),0) FROM coin_movements cm WHERE cm.shift_id=s.id) AS coins_out,
          (SELECT COALESCE(SUM(cm.quantity) FILTER(WHERE cm.direction='masuk' OR (cm.direction IS NULL AND cm.movement_type='masuk')),0) FROM coin_movements cm WHERE cm.shift_id=s.id) AS coins_in,
          (SELECT COALESCE(SUM(cm.quantity) FILTER(WHERE (cm.direction='keluar' OR (cm.direction IS NULL AND cm.movement_type='keluar')) AND ct.name='Koin Reguler'),0) FROM coin_movements cm JOIN coin_types ct ON ct.id=cm.coin_type_id WHERE cm.shift_id=s.id) AS regular_coins_out,
          (SELECT COALESCE(SUM(cm.quantity) FILTER(WHERE (cm.direction='keluar' OR (cm.direction IS NULL AND cm.movement_type='keluar')) AND ct.name='Koin Extra Dry'),0) FROM coin_movements cm JOIN coin_types ct ON ct.id=cm.coin_type_id WHERE cm.shift_id=s.id) AS extra_dry_coins_out,
          (SELECT COALESCE(SUM(ti.subtotal),0) FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id WHERE t.shift_id=s.id AND t.status='aktif' AND ti.item_type='product') AS product_sales,
          (SELECT COALESCE(SUM(im.quantity),0) FROM inventory_movements im JOIN transactions t ON t.id=im.reference_id WHERE t.shift_id=s.id AND im.movement_type='keluar') AS product_stock_out
          FROM shifts s JOIN users u ON u.id=s.user_id WHERE {$whereSql}
          ORDER BY s.started_at DESC,s.id DESC LIMIT ?";
        $q=$pdo->prepare($sql); $q->execute([...$params,$limit]); json_out(['items'=>$q->fetchAll(),'total'=>$count,'timezone'=>'Asia/Jakarta','date_basis'=>'shift_started_at','expense_ledger_ready'=>$expenseLedgerReady()]);
    }
    if ($method === 'POST' && $path === '/api/shifts/open') {
        require_csrf(); $u=require_user('kasir'); if (!$u['outlet_id']) json_out(['error'=>'Akun kasir belum ditautkan ke outlet.'],422); $i=body(); $type=$i['shift_type']??''; if (!in_array($type,['pagi','siang','sore','malam'],true)) json_out(['error'=>'Jenis shift tidak valid.'],422);
        $q=db()->prepare("INSERT INTO shifts(user_id,outlet_id,shift_type,started_at,status) VALUES(?,?,?,NOW(),'open') RETURNING id,shift_type,started_at");
        try { $q->execute([$u['id'],$u['outlet_id'],$type]); }
        catch(PDOException $e) { if($e->getCode()==='23505') json_out(['error'=>'Anda masih memiliki shift yang terbuka.'],409); throw $e; }
        json_out(['shift'=>$q->fetch()],201);
    }
    if ($method === 'POST' && $path === '/api/shifts/close') {
        require_csrf(); $u=require_user('kasir'); $input=body();
        $shiftId=filter_var($input['shift_id']??null,FILTER_VALIDATE_INT);
        if(!$shiftId || $shiftId<1) json_out(['error'=>'ID sesi shift yang akan ditutup tidak valid. Muat ulang dashboard.'],422);
        $pdo=db(); $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id,shift_type,started_at FROM shifts WHERE id=? AND user_id=? AND status='open' FOR UPDATE");
        $q->execute([$shiftId,$u['id']]); $shift=$q->fetch();
        if (!$shift) { $pdo->rollBack(); json_out(['error'=>'Sesi shift yang dikonfirmasi sudah berubah atau tidak lagi terbuka. Muat ulang dashboard sebelum mencoba lagi.'],409); }
        $q=$pdo->prepare("SELECT COALESCE(SUM(amount) FILTER(WHERE payment_method='tunai'),0) AS cash,COALESCE(SUM(amount) FILTER(WHERE payment_method='qris'),0) AS qris,COALESCE(SUM(amount),0) AS received_total,COUNT(*) AS payments FROM payments WHERE shift_id=?"); $q->execute([$shift['id']]); $payments=$q->fetch();
        $expensesReady=$expenseLedgerReady();
        if($expensesReady) { $q=$pdo->prepare("SELECT COALESCE(SUM(amount),0) AS total,COALESCE(SUM(amount) FILTER(WHERE funding_source='laci_kas'),0) AS cash,COALESCE(SUM(amount) FILTER(WHERE funding_source='rekening_usaha'),0) AS bank FROM expenses WHERE shift_id=?"); $q->execute([$shift['id']]); $expenses=$q->fetch(); }
        else $expenses=['total'=>null,'cash'=>null,'bank'=>null];
        $q=$pdo->prepare("SELECT COUNT(*) AS transactions,COUNT(*) FILTER(WHERE payment_status='belum_bayar') AS unpaid_count,COALESCE(SUM(total) FILTER(WHERE payment_status='belum_bayar'),0) AS unpaid_total,COALESCE(SUM(total) FILTER(WHERE payment_status='lunas'),0) AS paid_order_total FROM transactions WHERE shift_id=? AND status='aktif'"); $q->execute([$shift['id']]); $transactions=$q->fetch();
        $q=$pdo->prepare("SELECT COALESCE(SUM(quantity) FILTER(WHERE direction='masuk' OR (direction IS NULL AND movement_type='masuk')),0) AS coins_in,COALESCE(SUM(quantity) FILTER(WHERE direction='keluar' OR (direction IS NULL AND movement_type='keluar')),0) AS coins_out FROM coin_movements WHERE shift_id=?"); $q->execute([$shift['id']]); $coins=$q->fetch();
        $q=$pdo->prepare("SELECT COALESCE(SUM(ti.subtotal),0) FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id WHERE t.shift_id=? AND t.status='aktif' AND ti.item_type='product'"); $q->execute([$shift['id']]); $productSales=$q->fetchColumn();
        $q=$pdo->prepare("UPDATE shifts SET ended_at=NOW(),status='closed' WHERE id=? RETURNING ended_at"); $q->execute([$shift['id']]); $ended=$q->fetch();
        $pdo->commit(); json_out(['shift'=>array_merge($shift,$ended,['status'=>'closed']),'summary'=>['transactions'=>$transactions,'payments'=>$payments,'expenses'=>$expenses,'expense_ledger_ready'=>$expensesReady,'coins'=>$coins,'product_sales'=>$productSales,'physical_reconciliation_available'=>false]]);
    }
    if ($method === 'GET' && $path === '/api/orders') {
        $u=require_user('kasir');
        if (!$u['outlet_id']) json_out(['items'=>[],'total'=>0]);
        $where=['t.outlet_id=?','t.status=\'aktif\'']; $params=[(int)$u['outlet_id']];
        foreach (['from','to'] as $dateKey) {
            $date=$_GET[$dateKey]??'';
            if ($date==='') continue;
            $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Asia/Jakarta'));
            if (!$parsed || $parsed->format('Y-m-d')!==$date) json_out(['error'=>'Tanggal filter tidak valid.'],422);
            if ($dateKey==='to') $parsed=$parsed->modify('+1 day');
            $where[]=$dateKey==='from'?'t.created_at>=?':'t.created_at<?';
            $params[]=$parsed->format('Y-m-d H:i:sP');
        }
        $status=$_GET['status']??'';
        if ($status!=='' && !in_array($status,['menunggu','diproses','selesai','sudah_diambil','dibatalkan'],true)) json_out(['error'=>'Status pesanan tidak valid.'],422);
        if ($status!=='') { $where[]='lo.status=?'; $params[]=$status; }
        $paymentStatus=$_GET['payment_status']??'';
        if ($paymentStatus!=='' && !in_array($paymentStatus,['lunas','belum_bayar'],true)) json_out(['error'=>'Status pembayaran tidak valid.'],422);
        if ($paymentStatus!=='') { $where[]='t.payment_status=?'; $params[]=$paymentStatus; }
        $paymentMethod=$_GET['payment_method']??'';
        if ($paymentMethod!=='' && !in_array($paymentMethod,['tunai','qris'],true)) json_out(['error'=>'Metode pembayaran tidak valid.'],422);
        if ($paymentMethod!=='') { $where[]='COALESCE(t.payment_method,p.payment_method)=?'; $params[]=$paymentMethod; }
        if (isset($_GET['shift_id'])) {
            $shiftId=filter_var($_GET['shift_id'],FILTER_VALIDATE_INT);
            if (!$shiftId) json_out(['error'=>'Shift tidak valid.'],422);
            $where[]='t.shift_id=?'; $params[]=$shiftId;
        }
        $search=trim((string)($_GET['search']??''));
        if ($search!=='') {
            $where[]='(t.transaction_number ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ?)';
            array_push($params,'%'.$search.'%','%'.$search.'%','%'.$search.'%');
        }
        $whereSql=implode(' AND ',$where); $page=max(1,(int)($_GET['page']??1)); $limit=min(100,max(1,(int)($_GET['limit']??50)));
        $pdo=db(); $q=$pdo->prepare("SELECT COUNT(*) FROM laundry_orders lo JOIN transactions t ON t.id=lo.transaction_id LEFT JOIN customers c ON c.id=COALESCE(lo.customer_id,t.customer_id) LEFT JOIN payments p ON p.transaction_id=t.id WHERE {$whereSql}");
        $q->execute($params); $total=(int)$q->fetchColumn();
        $q=$pdo->prepare("SELECT lo.id,lo.transaction_id,lo.customer_id,lo.weight,lo.service_type,lo.status AS order_status,lo.estimated_completion,lo.completed_at,lo.picked_up_at,lo.notes,lo.created_at,
            t.transaction_number,t.transaction_type,t.total,t.payment_status,COALESCE(t.payment_method,p.payment_method) AS payment_method,p.amount AS paid_amount,p.paid_at,
            c.name AS customer,c.phone,u.name AS cashier,t.shift_id
          FROM laundry_orders lo JOIN transactions t ON t.id=lo.transaction_id
          LEFT JOIN customers c ON c.id=COALESCE(lo.customer_id,t.customer_id)
          LEFT JOIN payments p ON p.transaction_id=t.id JOIN users u ON u.id=t.cashier_id
          WHERE {$whereSql} ORDER BY lo.created_at DESC,lo.id DESC LIMIT ? OFFSET ?");
        $q->execute([...$params,$limit,($page-1)*$limit]); json_out(['items'=>$q->fetchAll(),'total'=>$total,'page'=>$page,'limit'=>$limit]);
    }
    if ($method === 'PATCH' && preg_match('#^/api/orders/([0-9]+)/status$#',$path,$matches)) {
        require_csrf(); $u=require_user('kasir'); $input=body();
        $next=$input['status']??'';
        $note=trim((string)($input['notes']??''));
        if (!in_array($next,['menunggu','diproses','selesai','sudah_diambil','dibatalkan'],true) || strlen($note)>1000) json_out(['error'=>'Status atau catatan perubahan tidak valid.'],422);
        $pdo=db(); $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT lo.id,lo.status FROM laundry_orders lo JOIN transactions t ON t.id=lo.transaction_id WHERE lo.id=? AND t.outlet_id=? FOR UPDATE OF lo");
        $q->execute([(int)$matches[1],(int)$u['outlet_id']]); $order=$q->fetch();
        if (!$order) { $pdo->rollBack(); json_out(['error'=>'Pesanan tidak ditemukan.'],404); }
        $transitions=['menunggu'=>['diproses','dibatalkan'],'diproses'=>['selesai','dibatalkan'],'selesai'=>['sudah_diambil'],'sudah_diambil'=>[],'dibatalkan'=>[]];
        if ($order['status']===$next) { $pdo->commit(); json_out(['ok'=>true,'status'=>$next]); }
        if (!in_array($next,$transitions[$order['status']],true)) { $pdo->rollBack(); json_out(['error'=>'Perubahan status pesanan tidak diizinkan.'],409); }
        $q=$pdo->prepare('UPDATE laundry_orders SET status=?,completed_at=CASE WHEN ?=\'selesai\' THEN NOW() ELSE completed_at END,picked_up_at=CASE WHEN ?=\'sudah_diambil\' THEN NOW() ELSE picked_up_at END WHERE id=?');
        $q->execute([$next,$next,$next,$order['id']]);
        $q=$pdo->prepare('INSERT INTO laundry_order_status_history(laundry_order_id,old_status,new_status,changed_by,notes) VALUES(?,?,?,?,?)');
        $q->execute([$order['id'],$order['status'],$next,$u['id'],$note?:null]);
        $pdo->commit(); json_out(['ok'=>true,'status'=>$next]);
    }
    if ($method === 'POST' && preg_match('#^/api/transactions/([0-9]+)/confirm-payment$#',$path,$matches)) {
        require_csrf(); $u=require_user('kasir');
        if (!$u['outlet_id']) json_out(['error'=>'Akun kasir belum ditautkan ke outlet.'],422);
        $input=body(); $paymentMethod=$input['payment_method']??'';
        if (!in_array($paymentMethod,['tunai','qris'],true)) json_out(['error'=>'Metode pembayaran tidak valid.'],422);
        $pdo=db(); $pdo->beginTransaction();
        $q=$pdo->prepare('SELECT id,total,payment_status,payment_method,status FROM transactions WHERE id=? AND outlet_id=? FOR UPDATE');
        $q->execute([(int)$matches[1],(int)$u['outlet_id']]); $transaction=$q->fetch();
        if (!$transaction) { $pdo->rollBack(); json_out(['error'=>'Transaksi tidak ditemukan.'],404); }
        if ($transaction['payment_method']!==null && $transaction['payment_method']!==$paymentMethod) { $pdo->rollBack(); json_out(['error'=>'Metode pelunasan harus sama dengan metode yang dipilih saat checkout.'],409); }
        if ($transaction['payment_status']==='lunas') {
            $q=$pdo->prepare('SELECT id,amount,paid_at,cashier_id,payment_method,confirmation_method FROM payments WHERE transaction_id=?');
            $q->execute([$transaction['id']]); $payment=$q->fetch();
            if (!$payment || $payment['payment_method']!==$paymentMethod) { $pdo->rollBack(); json_out(['error'=>'Transaksi sudah lunas melalui metode pembayaran lain.'],409); }
            $pdo->commit(); json_out(['ok'=>true,'duplicate'=>true,'payment'=>$payment]);
        }
        if ($transaction['status']!=='aktif' || (float)$transaction['total']<=0) {
            $pdo->rollBack(); json_out(['error'=>'Hanya transaksi aktif dengan tagihan positif yang dapat dilunasi.'],409);
        }
        $cashReceived=0.0; $changeAmount=0.0; $confirmationMethod=null;
        if ($paymentMethod==='tunai') {
            if (!is_numeric($input['cash_received']??null) || !is_finite((float)$input['cash_received']) || (float)$input['cash_received']<(float)$transaction['total']) {
                $pdo->rollBack(); json_out(['error'=>'Uang tunai yang diterima belum mencukupi.'],422);
            }
            $cashReceived=round((float)$input['cash_received'],2);
            $changeAmount=round($cashReceived-(float)$transaction['total'],2);
        } else {
            $confirmationMethod='manual';
        }
        $q=$pdo->prepare("SELECT id FROM shifts WHERE user_id=? AND outlet_id=? AND status='open' FOR UPDATE");
        $q->execute([$u['id'],$u['outlet_id']]); $shift=$q->fetch();
        if (!$shift) { $pdo->rollBack(); json_out(['error'=>'Buka shift sebelum mencatat penerimaan pembayaran.'],409); }
        $q=$pdo->prepare("INSERT INTO payments(transaction_id,shift_id,cashier_id,payment_method,confirmation_method,amount) VALUES(?,?,?,?,?,?) RETURNING id,amount,paid_at,cashier_id,payment_method,confirmation_method");
        $q->execute([$transaction['id'],$shift['id'],$u['id'],$paymentMethod,$confirmationMethod,$transaction['total']]); $payment=$q->fetch();
        $q=$pdo->prepare("UPDATE transactions SET payment_status='lunas',payment_method=?,cash_received=?,change_amount=? WHERE id=? AND payment_status='belum_bayar'");
        $q->execute([$paymentMethod,$cashReceived,$changeAmount,$transaction['id']]);
        $pdo->commit(); json_out(['ok'=>true,'duplicate'=>false,'payment'=>$payment]);
    }
    if ($method === 'GET' && $path === '/api/transactions') {
        $u=require_user('kasir');
        $where=['t.outlet_id=?','t.status=\'aktif\''];
        $params=[(int)$u['outlet_id']];
        foreach (['from','to'] as $dateKey) {
            $date=$_GET[$dateKey]??'';
            if ($date==='') continue;
            $parsed=DateTimeImmutable::createFromFormat('!Y-m-d',$date,new DateTimeZone('Asia/Jakarta'));
            if (!$parsed || $parsed->format('Y-m-d')!==$date) json_out(['error'=>'Tanggal filter tidak valid.'],422);
            if ($dateKey==='to') $parsed=$parsed->modify('+1 day');
            $where[]=$dateKey==='from'?'t.created_at>=?':'t.created_at<?';
            $params[]=$parsed->format('Y-m-d H:i:sP');
        }
        $search=trim((string)($_GET['search']??''));
        if ($search!=='') {
            $where[]='(t.transaction_number ILIKE ? OR c.name ILIKE ? OR c.phone ILIKE ?)';
            array_push($params,'%'.$search.'%','%'.$search.'%','%'.$search.'%');
        }
        $paymentStatus=$_GET['payment_status']??'';
        if ($paymentStatus!=='' && !in_array($paymentStatus,['lunas','belum_bayar'],true)) json_out(['error'=>'Status pembayaran tidak valid.'],422);
        if ($paymentStatus!=='') { $where[]='t.payment_status=?'; $params[]=$paymentStatus; }
        $paymentMethod=$_GET['payment_method']??'';
        if ($paymentMethod!=='' && !in_array($paymentMethod,['tunai','qris'],true)) json_out(['error'=>'Metode pembayaran tidak valid.'],422);
        if ($paymentMethod!=='') { $where[]='COALESCE(t.payment_method,p.payment_method)=?'; $params[]=$paymentMethod; }
        $shiftId=filter_var($_GET['shift_id']??null,FILTER_VALIDATE_INT);
        if (isset($_GET['shift_id']) && $shiftId===false) json_out(['error'=>'Shift tidak valid.'],422);
        if ($shiftId) { $where[]='t.shift_id=?'; $params[]=$shiftId; }
        $category=$_GET['category']??'';
        $allowedCategories=['Self Service','Drop Off','Cuci Kering Setrika','Setrika Saja','Produk & Minuman'];
        if ($category!=='' && !in_array($category,$allowedCategories,true)) json_out(['error'=>'Kategori transaksi tidak valid.'],422);
        if ($category==='Produk & Minuman') {
            $where[]="EXISTS (SELECT 1 FROM transaction_items ti WHERE ti.transaction_id=t.id AND ti.item_type='product')";
        } elseif ($category!=='') {
            $where[]="EXISTS (SELECT 1 FROM transaction_items ti JOIN services s ON s.id=ti.service_id WHERE ti.transaction_id=t.id AND s.category=?)";
            $params[]=$category;
        }
        $whereSql=implode(' AND ',$where);
        $page=max(1,(int)($_GET['page']??1));
        $limit=min(100,max(1,(int)($_GET['limit']??50)));
        $offset=($page-1)*$limit;
        $pdo=db();
        $q=$pdo->prepare("SELECT COUNT(*) FROM transactions t LEFT JOIN customers c ON c.id=t.customer_id LEFT JOIN payments p ON p.transaction_id=t.id WHERE {$whereSql}");
        $q->execute($params); $count=(int)$q->fetchColumn();
        $q=$pdo->prepare("SELECT
            t.id,t.transaction_number,t.transaction_type,t.subtotal,t.discount_amount,t.delivery_fee,t.total,
            t.payment_status,COALESCE(t.payment_method,p.payment_method) AS payment_method,
            t.cash_received,t.change_amount,t.notes,t.weight_kg,t.washer_machine_count,t.dryer_machine_count,t.created_at,
            c.name AS customer,c.phone,
            COALESCE(p.amount,0) AS paid_amount,p.paid_at,p.confirmation_method,
            u.name AS cashier,
            (SELECT json_agg(json_build_object('description',ti.description,'item_type',ti.item_type,'quantity',ti.quantity,'unit_price',ti.unit_price,'subtotal',ti.subtotal,'category',COALESCE(s.category,pr.category)))
             FROM transaction_items ti
             LEFT JOIN services s ON s.id=ti.service_id
             LEFT JOIN products pr ON pr.id=ti.product_id
             WHERE ti.transaction_id=t.id) AS items
          FROM transactions t
          LEFT JOIN customers c ON c.id=t.customer_id
          LEFT JOIN payments p ON p.transaction_id=t.id
          JOIN users u ON u.id=t.cashier_id
          WHERE {$whereSql}
          ORDER BY t.created_at DESC,t.id DESC LIMIT ? OFFSET ?");
        $q->execute([...$params,$limit,$offset]); $items=$q->fetchAll();
        $q=$pdo->prepare("SELECT
            COALESCE(SUM(t.total),0) AS transaction_value,
            COUNT(*) FILTER(WHERE t.payment_status='belum_bayar') AS unpaid_count,
            COALESCE(SUM(t.total) FILTER(WHERE t.payment_status='lunas'),0) AS revenue,
            COALESCE(SUM(p.amount),0) AS received,
            COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='tunai'),0) AS cash,
            COALESCE(SUM(p.amount) FILTER(WHERE p.payment_method='qris'),0) AS qris
          FROM transactions t
          LEFT JOIN customers c ON c.id=t.customer_id
          LEFT JOIN payments p ON p.transaction_id=t.id
          WHERE {$whereSql}");
        $q->execute($params); json_out(['items'=>$items,'total'=>$count,'page'=>$page,'limit'=>$limit,'summary'=>$q->fetch()]);
    }
    if ($method === 'GET' && preg_match('#^/api/transactions/([0-9]+)$#',$path,$matches)) {
        $u=require_user('kasir'); $pdo=db();
        $q=$pdo->prepare("SELECT t.*,c.name AS customer,c.phone,COALESCE(t.payment_method,p.payment_method) AS selected_payment_method,p.payment_method AS received_payment_method,p.amount AS paid_amount,p.paid_at,u.name AS cashier
          FROM transactions t
          LEFT JOIN customers c ON c.id=t.customer_id
          LEFT JOIN payments p ON p.transaction_id=t.id
          JOIN users u ON u.id=t.cashier_id
          WHERE t.id=? AND t.outlet_id=?");
        $q->execute([(int)$matches[1],(int)$u['outlet_id']]); $transaction=$q->fetch();
        if (!$transaction) json_out(['error'=>'Transaksi tidak ditemukan.'],404);
        $q=$pdo->prepare("SELECT ti.item_type,ti.description,ti.quantity,ti.unit_price,ti.subtotal,s.category AS service_category,p.category AS product_category
          FROM transaction_items ti LEFT JOIN services s ON s.id=ti.service_id LEFT JOIN products p ON p.id=ti.product_id
          WHERE ti.transaction_id=? ORDER BY ti.id");
        $q->execute([$transaction['id']]); $transaction['items']=$q->fetchAll();
        json_out(['transaction'=>$transaction]);
    }
    if ($method === 'POST' && $path === '/api/transactions') {
        require_csrf(); $u=require_user('kasir'); $i=body(); $lines=$i['items']??[];
        $methodPay=$i['payment_method']??null;
        $idempotencyKey=trim((string)($_SERVER['HTTP_IDEMPOTENCY_KEY']??''));
        if (!$u['outlet_id'] || !is_array($lines) || !$lines || count($lines)>100) json_out(['error'=>'Data transaksi belum lengkap atau akun belum ditautkan ke outlet.'],422);
        if ($methodPay!==null && !in_array($methodPay,['tunai','qris'],true)) json_out(['error'=>'Metode pembayaran tidak valid.'],422);
        if ($idempotencyKey==='' || strlen($idempotencyKey)>100 || !preg_match('/^[A-Za-z0-9._:-]+$/',$idempotencyKey)) json_out(['error'=>'Kunci transaksi tidak valid. Silakan coba kembali.'],422);
        $requestHash=hash('sha256',json_encode($i,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
        $pdo=db();
        $loadExisting=static function(PDO $pdo,string $key,int $outletId): ?array {
            $q=$pdo->prepare('SELECT id,transaction_number,total,payment_status,payment_method,created_at,change_amount,request_hash FROM transactions WHERE idempotency_key=? AND outlet_id=?');
            $q->execute([$key,$outletId]); return $q->fetch()?:null;
        };
        $existing=$loadExisting($pdo,$idempotencyKey,(int)$u['outlet_id']);
        if ($existing) {
            if (!hash_equals(trim((string)$existing['request_hash']),$requestHash)) json_out(['error'=>'Kunci transaksi sudah digunakan dengan data berbeda.'],409);
            unset($existing['request_hash']); json_out(['transaction'=>$existing,'change'=>(float)$existing['change_amount'],'duplicate'=>true]);
        }
        $customerName=trim((string)($i['customer_name']??''));
        $customerPhone=trim((string)($i['customer_phone']??''));
        $notes=trim((string)($i['notes']??''));
        $customerNameLength=preg_match_all('/./us',$customerName);
        $customerPhoneLength=preg_match_all('/./us',$customerPhone);
        $notesLength=preg_match_all('/./us',$notes);
        if ($customerNameLength===false || $customerPhoneLength===false || $notesLength===false || $customerNameLength>100 || $customerPhoneLength>30 || $notesLength>2000) json_out(['error'=>'Data pelanggan atau catatan melebihi batas panjang.'],422);
        if ($customerPhone!=='' && $customerName==='') json_out(['error'=>'Nama pelanggan wajib diisi jika nomor telepon dicatat.'],422);
        $weightInput=$i['weight_kg']??null;
        $weight=null;
        if ($weightInput!==null && $weightInput!=='') {
            if (!is_numeric($weightInput) || !is_finite((float)$weightInput) || (float)$weightInput<=0 || (float)$weightInput>9999.99) json_out(['error'=>'Berat laundry harus lebih besar dari nol dan valid.'],422);
            $weight=round((float)$weightInput,2);
        }
        $deliveryInput=$i['delivery_fee']??0;
        $discountInput=$i['discount_amount']??0;
        if (!is_numeric($deliveryInput) || !is_finite((float)$deliveryInput) || (float)$deliveryInput<0 || (float)$deliveryInput>9999999999.99) json_out(['error'=>'Ongkir tidak valid.'],422);
        if (!is_numeric($discountInput) || !is_finite((float)$discountInput) || (float)$discountInput<0 || (float)$discountInput>9999999999.99) json_out(['error'=>'Diskon tidak valid.'],422);
        $deliveryFee=round((float)$deliveryInput,2); $discount=round((float)$discountInput,2);

        $pdo->beginTransaction();
        $q=$pdo->prepare("SELECT id FROM shifts WHERE user_id=? AND outlet_id=? AND status='open' FOR UPDATE");
        $q->execute([$u['id'],$u['outlet_id']]); $shift=$q->fetch();
        if (!$shift) { $pdo->rollBack(); json_out(['error'=>'Buka shift sebelum membuat transaksi.'],409); }
        $subtotal=0.0; $resolved=[]; $serviceCategories=[]; $primarySelfServices=[]; $reservedStock=[]; $hasExtraDry=false;
        $coinRequirements=['Koin Reguler'=>0,'Koin Extra Dry'=>0];
        $machineCountForWeight=$weight===null?0:(int)ceil($weight/7);
        $night=(int)(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('G')>=23 || (int)(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('G')<6;
        foreach ($lines as $line) {
            if (!is_array($line)) { $pdo->rollBack(); json_out(['error'=>'Format item transaksi tidak valid.'],422); }
            $qtyInput=$line['quantity']??0;
            if (!is_numeric($qtyInput) || !is_finite((float)$qtyInput)) { $pdo->rollBack(); json_out(['error'=>'Jumlah item tidak valid.'],422); }
            $qty=(float)$qtyInput;
            if ($qty<=0 || $qty>10000) { $pdo->rollBack(); json_out(['error'=>'Jumlah item tidak valid.'],422); }
            if (!empty($line['service_id']) && empty($line['product_id'])) {
                $q=$pdo->prepare("SELECT s.id,s.code,s.name,s.category,s.pricing_unit,
                    COALESCE((SELECT price FROM service_prices WHERE service_id=s.id AND price_type=? AND is_active ORDER BY id DESC LIMIT 1),s.base_price) AS price
                    FROM services s WHERE s.id=? AND s.is_active");
                $q->execute([$night?'malam':'normal',(int)$line['service_id']]); $item=$q->fetch(); $itemType='service';
                if ($item) {
                    $serviceCategories[$item['category']]=true;
                    if ($item['category']==='Self Service' && in_array($item['code'],['SELF-CUCI','SELF-KERING','SELF-CUCI-KERING'],true)) $primarySelfServices[$item['code']]=true;
                    if ($item['category']==='Self Service' && $item['code']==='SELF-EXTRA-DRY') $hasExtraDry=true;
                }
            } elseif (!empty($line['product_id']) && empty($line['service_id'])) {
                $q=$pdo->prepare('SELECT id,name,category,price,stock,unit FROM products WHERE id=? AND is_active FOR UPDATE');
                $q->execute([(int)$line['product_id']]); $item=$q->fetch(); $itemType='product';
                if ($item && (float)$item['stock']-(float)($reservedStock[$item['id']]??0)<$qty) { $pdo->rollBack(); json_out(['error'=>'Stok produk tidak mencukupi.'],409); }
                if ($item) $reservedStock[$item['id']]=(float)($reservedStock[$item['id']]??0)+$qty;
            } else {
                $pdo->rollBack(); json_out(['error'=>'Item transaksi harus berupa satu layanan atau satu produk.'],422);
            }
            if (!$item) { $pdo->rollBack(); json_out(['error'=>'Item tidak ditemukan atau tidak aktif.'],422); }
            $effectiveQty=$itemType==='service' && $item['pricing_unit']==='kg' ? $qty*($weight??0) : $qty;
            if ($itemType==='service' && $item['category']==='Self Service' && $item['pricing_unit']==='siklus') {
                if (floor($qty)!==$qty) { $pdo->rollBack(); json_out(['error'=>'Jumlah siklus Self Service harus berupa bilangan bulat.'],422); }
                if ($weight!==null) $effectiveQty=$qty*$machineCountForWeight;
                $coinQuantity=(int)($qty*$machineCountForWeight);
                if ($item['code']==='SELF-CUCI' || $item['code']==='SELF-KERING') $coinRequirements['Koin Reguler']+=$coinQuantity;
                elseif ($item['code']==='SELF-CUCI-KERING') $coinRequirements['Koin Reguler']+=$coinQuantity*2;
                elseif ($item['code']==='SELF-EXTRA-DRY') $coinRequirements['Koin Extra Dry']+=$coinQuantity;
            }
            if ($effectiveQty<=0) { $pdo->rollBack(); json_out(['error'=>'Masukkan berat laundry lebih besar dari nol untuk layanan per kilogram.'],422); }
            $lineTotal=round((float)$item['price']*$effectiveQty,2);
            $subtotal=round($subtotal+$lineTotal,2);
            $resolved[]=['item'=>$item,'type'=>$itemType,'quantity'=>$effectiveQty,'total'=>$lineTotal];
        }
        if (count($serviceCategories)>1) { $pdo->rollBack(); json_out(['error'=>'Pisahkan jenis layanan utama yang berbeda ke transaksi terpisah.'],422); }
        if (count($primarySelfServices)>1) { $pdo->rollBack(); json_out(['error'=>'Pilih hanya satu layanan utama Self Service untuk kelompok cucian ini.'],422); }
        if ($serviceCategories && $weight===null) { $pdo->rollBack(); json_out(['error'=>'Berat laundry wajib diisi dan harus lebih besar dari nol.'],422); }
        if ($discount>$subtotal) { $pdo->rollBack(); json_out(['error'=>'Diskon tidak boleh melebihi subtotal layanan dan produk.'],422); }
        $total=round($subtotal+$deliveryFee-$discount,2);
        $cashInput=$i['cash_received']??0;
        if (!is_numeric($cashInput) || !is_finite((float)$cashInput) || (float)$cashInput<0) { $pdo->rollBack(); json_out(['error'=>'Nominal uang diterima tidak valid.'],422); }
        $cash=round((float)$cashInput,2);
        if ($methodPay==='tunai' && $cash<$total) { $pdo->rollBack(); json_out(['error'=>'Uang tunai yang diterima belum mencukupi.'],422); }
        $machineCount=null; $dryerMachineCount=null;
        if ($weight!==null && (isset($primarySelfServices['SELF-CUCI']) || isset($primarySelfServices['SELF-CUCI-KERING']))) $machineCount=$machineCountForWeight;
        if ($weight!==null && (isset($primarySelfServices['SELF-KERING']) || isset($primarySelfServices['SELF-CUCI-KERING']) || $hasExtraDry)) $dryerMachineCount=$machineCountForWeight;
        $type='product'; $serviceType=null;
        if ($serviceCategories) {
            $serviceType=(string)array_key_first($serviceCategories);
            $type=$serviceType==='Drop Off'?'drop_off':($serviceType==='Self Service'?'self_service':'laundry');
        }
        $paymentStatus=$methodPay==='tunai'?'lunas':'belum_bayar';
        $cashChange=$methodPay==='tunai'?round($cash-$total,2):0.0;
        $customerId=null;
        if ($customerName!=='') {
            $q=$pdo->prepare('INSERT INTO customers(name,phone) VALUES(?,?) RETURNING id');
            $q->execute([$customerName,$customerPhone?:null]); $customerId=(int)$q->fetchColumn();
        }
        $nextId=(int)$pdo->query("SELECT nextval(pg_get_serial_sequence('transactions','id'))")->fetchColumn();
        $number='KINO-'.(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('ymd').'-'.str_pad((string)$nextId,8,'0',STR_PAD_LEFT);
        try {
            $q=$pdo->prepare("INSERT INTO transactions(id,outlet_id,transaction_number,customer_id,cashier_id,shift_id,transaction_type,subtotal,discount_amount,delivery_fee,total,notes,weight_kg,washer_machine_count,dryer_machine_count,payment_method,cash_received,change_amount,idempotency_key,request_hash,payment_status,status)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'aktif') RETURNING id,transaction_number,total,payment_status,payment_method,created_at,change_amount,washer_machine_count,dryer_machine_count");
            $q->execute([$nextId,$u['outlet_id'],$number,$customerId,$u['id'],$shift['id'],$type,$subtotal,$discount,$deliveryFee,$total,$notes?:null,$weight,$machineCount,$dryerMachineCount,$methodPay,$methodPay==='tunai'?$cash:0,$cashChange,$idempotencyKey,$requestHash,$paymentStatus]);
            $trx=$q->fetch();
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($e->getCode()==='23505') {
                $duplicate=$loadExisting($pdo,$idempotencyKey,(int)$u['outlet_id']);
                if ($duplicate) {
                    if (!hash_equals(trim((string)$duplicate['request_hash']),$requestHash)) json_out(['error'=>'Kunci transaksi sudah digunakan dengan data berbeda.'],409);
                    unset($duplicate['request_hash']); json_out(['transaction'=>$duplicate,'change'=>(float)$duplicate['change_amount'],'duplicate'=>true]);
                }
            }
            throw $e;
        }
        foreach ($resolved as $r) {
            if ($r['type']==='service') {
                $q=$pdo->prepare("INSERT INTO transaction_items(transaction_id,item_type,service_id,description,quantity,unit_price,subtotal) VALUES(?,'service',?,?,?,?,?)");
                $q->execute([$trx['id'],$r['item']['id'],$r['item']['name'],$r['quantity'],$r['item']['price'],$r['total']]);
            } else {
                $q=$pdo->prepare("INSERT INTO transaction_items(transaction_id,item_type,product_id,description,quantity,unit_price,subtotal) VALUES(?,'product',?,?,?,?,?)");
                $q->execute([$trx['id'],$r['item']['id'],$r['item']['name'],$r['quantity'],$r['item']['price'],$r['total']]);
                $q=$pdo->prepare('UPDATE products SET stock=stock-? WHERE id=?');
                $q->execute([$r['quantity'],$r['item']['id']]);
                $q=$pdo->prepare("INSERT INTO inventory_movements(product_id,quantity,movement_type,direction,user_id,reason,reference_id) VALUES(?,?,'keluar','keluar',?,'Penjualan transaksi',?)");
                $q->execute([$r['item']['id'],$r['quantity'],$u['id'],$trx['id']]);
            }
        }
        if (array_sum($coinRequirements)>0) {
            $q=$pdo->prepare("SELECT id,name,stock FROM coin_types WHERE name IN ('Koin Reguler','Koin Extra Dry') AND is_active ORDER BY id FOR UPDATE");
            $q->execute(); $coinBalances=[];
            foreach ($q->fetchAll() as $coin) $coinBalances[$coin['name']]=$coin;
            foreach ($coinRequirements as $coinName=>$required) {
                if ($required<=0) continue;
                if (!isset($coinBalances[$coinName])) { $pdo->rollBack(); json_out(['error'=>"Jenis koin {$coinName} belum tersedia."],409); }
                if ((int)$coinBalances[$coinName]['stock']<$required) { $pdo->rollBack(); json_out(['error'=>"Stok {$coinName} tidak mencukupi."],409); }
                $coinId=(int)$coinBalances[$coinName]['id'];
                $q=$pdo->prepare('UPDATE coin_types SET stock=stock-? WHERE id=?');
                $q->execute([$required,$coinId]);
                $q=$pdo->prepare("INSERT INTO coin_movements(coin_type_id,transaction_id,shift_id,quantity,movement_type,direction,user_id,reason) VALUES(?,?,?,?,'keluar','keluar',?,?)");
                $q->execute([$coinId,$trx['id'],$shift['id'],$required,$u['id'],'Pemakaian koin otomatis untuk transaksi '.$number]);
            }
        }
        if ($methodPay==='tunai' && $total>0) {
            $q=$pdo->prepare("INSERT INTO payments(transaction_id,shift_id,cashier_id,payment_method,amount) VALUES(?,?,?,?,?)");
            $q->execute([$trx['id'],$shift['id'],$u['id'],'tunai',$total]);
        }
        if ($type==='drop_off' || $type==='laundry') {
            $q=$pdo->prepare("INSERT INTO laundry_orders(transaction_id,customer_id,weight,service_type,status,notes) VALUES(?,?,?,?,'menunggu',?) RETURNING id");
            $q->execute([$trx['id'],$customerId,$weight,$serviceType,$notes?:null]); $orderId=(int)$q->fetchColumn();
            $q=$pdo->prepare("INSERT INTO laundry_order_status_history(laundry_order_id,new_status,changed_by) VALUES(?,'menunggu',?)");
            $q->execute([$orderId,$u['id']]);
        }
        $pdo->commit();
        json_out(['transaction'=>$trx,'change'=>$cashChange,'duplicate'=>false],201);
    }
    json_out(['error'=>'Endpoint tidak ditemukan.'],404);
} catch (Throwable $e) {
    error_log((string)$e); json_out(['error'=>getenv('APP_ENV')==='local'?$e->getMessage():'Terjadi kesalahan pada server.'],500);
}
