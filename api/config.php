<?php
/**
 * Configuración de conexión a PostgreSQL (Railway)
 */

// Obtener variables de entorno de Railway
$host = getenv('PGHOST');
$port = getenv('PGPORT') ?: '5432';
$dbname = getenv('PGDATABASE') ?: 'railway';
$user = getenv('PGUSER') ?: 'postgres';
$password = getenv('PGPASSWORD');

// Log para debug (puede eliminarse en producción)
error_log("DB Config: host=$host, port=$port, dbname=$dbname, user=$user, pass=" . ($password ? 'SET' : 'EMPTY'));

$pdo = null;

if ($host && $password) {
    try {
        $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";
        $pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        error_log("DB Connection successful");
    } catch (PDOException $e) {
        error_log("DB Connection Error: " . $e->getMessage());
        // No detenemos la ejecución, simplemente $pdo queda null
    }
} else {
    error_log("DB credentials missing - running without database");
}

// Número de temporada actual (cambiar manualmente para nuevas temporadas)
define('CURRENT_SEASON_NUMBER', 1);

// Iniciar sesión si no está activa
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>
