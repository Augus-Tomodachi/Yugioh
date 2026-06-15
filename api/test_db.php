<?php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 1);
error_reporting(E_ALL);

$host = getenv('PGHOST');
$port = getenv('PGPORT') ?: '5432';
$dbname = getenv('PGDATABASE') ?: 'railway';
$user = getenv('PGUSER') ?: 'postgres';
$password = getenv('PGPASSWORD');

if (!$host || !$password) {
    echo json_encode(['error' => 'Variables de entorno incompletas']);
    exit;
}

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    echo json_encode(['connected' => true, 'dbname' => $dbname]);
    
    // Listar tablas existentes
    $stmt = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo json_encode(['tables' => $tables]);
    
    // Si no hay tablas, crearlas
    if (empty($tables)) {
        // Leer archivo schema.sql si existe, o ejecutar el SQL directamente
        $schema = "
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                vidas INT DEFAULT 5,
                maleta VARCHAR(30),
                avatar_seed VARCHAR(20) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ultimo_login TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS seasons (
                id SERIAL PRIMARY KEY,
                numero INT UNIQUE NOT NULL,
                activa BOOLEAN DEFAULT false
            );
            CREATE TABLE IF NOT EXISTS season_maletas (
                season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
                maleta TEXT NOT NULL,
                PRIMARY KEY (season_id, maleta)
            );
            CREATE TABLE IF NOT EXISTS user_maleta_choices (
                user_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
                season_id INT REFERENCES seasons(id) ON DELETE CASCADE,
                maleta TEXT NOT NULL,
                chosen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, season_id)
            );
            CREATE TABLE IF NOT EXISTS user_decks (
                user_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
                maleta TEXT NOT NULL,
                deck_cards JSONB NOT NULL DEFAULT '[]',
                PRIMARY KEY (user_id, maleta)
            );
            INSERT INTO seasons (numero, activa) VALUES (1, true) ON CONFLICT DO NOTHING;
            INSERT INTO season_maletas (season_id, maleta) VALUES
                (1, 'Maleta Cobalto'),
                (1, 'Maleta Purpura'),
                (1, 'Maleta Cobre')
            ON CONFLICT DO NOTHING;
        ";
        $pdo->exec($schema);
        echo json_encode(['tables_created' => true]);
    }
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
