<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'Servicio no disponible (sin base de datos)']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

$nombre = trim($input['nombre'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

// Validaciones
if (strlen($nombre) < 3 || strlen($nombre) > 50) {
    echo json_encode(['error' => 'El nombre debe tener entre 3 y 50 caracteres']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['error' => 'Correo electrónico no válido']);
    exit;
}
if (strlen($password) < 6 || !preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/[0-9]/', $password)) {
    echo json_encode(['error' => 'La contraseña debe tener al menos 6 caracteres, una mayúscula, una minúscula y un número']);
    exit;
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$avatarSeed = substr(md5($email), 0, 10);

try {
    $stmt = $pdo->prepare("INSERT INTO usuarios (nombre, email, password_hash, avatar_seed) VALUES (:nombre, :email, :hash, :seed)");
    $stmt->execute([
        ':nombre' => $nombre,
        ':email' => $email,
        ':hash' => $hash,
        ':seed' => $avatarSeed
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Usuario registrado correctamente',
        'id' => $pdo->lastInsertId()
    ]);
} catch (PDOException $e) {
    if ($e->getCode() == 23505) {
        // Violación de unicidad
        $msg = (strpos($e->getMessage(), 'email') !== false)
            ? 'El correo ya está registrado'
            : 'El nombre de usuario ya existe';
        echo json_encode(['error' => $msg]);
    } else {
        error_log("Register error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar el usuario']);
    }
}
?>
