<?php
declare(strict_types=1);
require dirname(__DIR__) . '/bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function ask(string $label): string { fwrite(STDOUT, $label); return trim((string)fgets(STDIN)); }
$name=ask('Nama lengkap: '); $username=ask('Nama pengguna: '); $email=ask('Email (boleh kosong): '); $role=ask('Peran (owner/kasir/karyawan): '); $password=ask('Kata sandi (min. 10 karakter): ');
if (!$name || !$username || !in_array($role,['owner','kasir','karyawan'],true) || strlen($password)<10) { fwrite(STDERR,"Input tidak valid. Kata sandi minimal 10 karakter.\n"); exit(1); }
$outlet=null;
if ($role!=='owner') { $outlet=db()->query('SELECT id FROM outlets WHERE is_active=TRUE ORDER BY id LIMIT 1')->fetchColumn(); if (!$outlet) { fwrite(STDERR,"Belum ada outlet. Jalankan database/schema.sql lebih dulu.\n");exit(1); } }
$q=db()->prepare('INSERT INTO users(outlet_id,name,username,email,password_hash,role) VALUES(?,?,?,?,?,?) RETURNING id,name,username,role');
$q->execute([$outlet?:null,$name,$username,$email?:null,password_hash($password,PASSWORD_DEFAULT),$role]); fwrite(STDOUT,json_encode($q->fetch(),JSON_UNESCAPED_UNICODE)."\nAkun berhasil dibuat.\n");
