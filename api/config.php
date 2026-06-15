<?php
// Para desarrollo local (sin Railway)
$host = getenv('PGHOST') ?: 'localhost';
$port = getenv('PGPORT') ?: '5432';
$dbname = getenv('PGDATABASE') ?: 'railway';
$user = getenv('PGUSER') ?: 'postgres';
$password = getenv('PGPASSWORD') ?: '';

try {
    $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    // Si no hay base de datos, igual permitir que funcione
    $pdo = null;
    error_log("DB Connection Error: " . $e->getMessage());
}

define('CURRENT_SEASON_NUMBER', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
