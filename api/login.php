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

if (empty($nombre) || empty($password)) {
    echo json_encode(['error' => 'Nombre de usuario y contraseña son requeridos']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, nombre, password_hash, vidas, maleta FROM usuarios WHERE nombre = :nombre");
    $stmt->execute([':nombre' => $nombre]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Regenerar ID de sesión por seguridad
        session_regenerate_id(true);
        
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['nombre'] = $user['nombre'];
        $_SESSION['last_activity'] = time();
        
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'nombre' => $user['nombre'],
                'vidas' => (int)$user['vidas'],
                'maleta' => $user['maleta']
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Credenciales incorrectas']);
    }
} catch (PDOException $e) {
    error_log("Error en login: " . $e->getMessage());
    echo json_encode(['error' => 'Error al iniciar sesión']);
}
?>