<?php
require 'config.php';
header('Content-Type: application/json; charset=utf-8');

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

$nombre = trim($data['nombre'] ?? '');
$password = $data['password'] ?? '';

// Validaciones
if (strlen($nombre) < 3) {
    echo json_encode(['error' => 'El nombre de usuario debe tener al menos 3 caracteres']);
    exit;
}

if (strlen($password) < 4) {
    echo json_encode(['error' => 'La contraseña debe tener al menos 4 caracteres']);
    exit;
}

if (strlen($nombre) > 50) {
    echo json_encode(['error' => 'El nombre de usuario es demasiado largo (máx. 50)']);
    exit;
}

// Encriptar contraseña
$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

try {
    $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, password_hash) VALUES (:nombre, :hash)");
    $stmt->execute([
        ':nombre' => $nombre,
        ':hash' => $hash
    ]);
    
    $userId = $pdo->lastInsertId();
    
    echo json_encode([
        'success' => true,
        'message' => 'Usuario registrado correctamente',
        'id' => $userId
    ]);
} catch (PDOException $e) {
    if ($e->getCode() == 23505) { // unique violation
        echo json_encode(['error' => 'El nombre de usuario ya existe']);
    } else {
        error_log("Error en registro: " . $e->getMessage());
        echo json_encode(['error' => 'Error al registrar el usuario']);
    }
}
?>