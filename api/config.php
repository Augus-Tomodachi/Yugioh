<?php
// Configuración de conexión a PostgreSQL en Railway
$host = getenv('PGHOST');           // postgres.railway.internal
$port = getenv('PGPORT');           // 5432
$dbname = getenv('PGDATABASE');     // railway
$user = getenv('PGUSER');           // postgres
$password = getenv('PGPASSWORD');   // aFyvUFdpPymtcnrGtNsjuUmnGSYhzuGr

// Si no se encuentran las variables de entorno, usar valores por defecto (desarrollo local)
if (!$host) $host = 'localhost';
if (!$port) $port = '5432';
if (!$dbname) $dbname = 'railway';
if (!$user) $user = 'postgres';
if (!$password) $password = '';

try {
    $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    // En producción, no mostrar detalles del error
    error_log("Error de conexión a la base de datos: " . $e->getMessage());
    die(json_encode(['error' => 'Error de conexión a la base de datos']));
}

// ⚠️ CAMBIAR ESTE NÚMERO AL INICIAR UNA NUEVA TEMPORADA
define('CURRENT_SEASON_NUMBER', 1);

// Configuración de sesión
if (session_status() === PHP_SESSION_NONE) {
    // Configurar sesión segura
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_only_cookies', 1);
    session_start();
}
?>