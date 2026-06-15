<?php
require_once __DIR__ . '/config.php';

// Solo para depuración (quitar en producción)
ini_set('display_errors', 1);
error_reporting(E_ALL);

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
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['error' => 'Correo y contraseña son requeridos']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, nombre, email, password_hash, vidas, maleta FROM usuarios WHERE email = :email");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Asegurar que la sesión esté activa
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        } else {
            session_start();
        }
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['nombre'] = $user['nombre'];
        $_SESSION['last_activity'] = time();

        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'nombre' => $user['nombre'],
                'email' => $user['email'],
                'vidas' => (int)$user['vidas'],
                'maleta' => $user['maleta']
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Credenciales incorrectas']);
    }
} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error en el servidor: ' . $e->getMessage()]); // mostrar mensaje real solo en debug
}
?>
