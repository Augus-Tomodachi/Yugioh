<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['logged_in' => false]);
    exit;
}

// Verificar inactividad máxima (30 minutos)
$maxInactivity = 1800;
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $maxInactivity)) {
    session_unset();
    session_destroy();
    echo json_encode(['logged_in' => false]);
    exit;
}
$_SESSION['last_activity'] = time();

if (!$pdo) {
    // Sin base de datos, devolvemos los datos básicos de sesión
    echo json_encode([
        'logged_in' => true,
        'user' => [
            'id' => $_SESSION['user_id'],
            'nombre' => $_SESSION['nombre'] ?? 'Usuario',
            'vidas' => 5,
            'maleta' => $_SESSION['maleta'] ?? null
        ]
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id, nombre, email, vidas, maleta FROM usuarios WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if ($user) {
        echo json_encode([
            'logged_in' => true,
            'user' => [
                'id' => $user['id'],
                'nombre' => $user['nombre'],
                'email' => $user['email'] ?? '',
                'vidas' => (int)$user['vidas'],
                'maleta' => $user['maleta'],
            ]
        ]);
    } else {
        session_destroy();
        echo json_encode(['logged_in' => false]);
    }
} catch (PDOException $e) {
    error_log("Session error: " . $e->getMessage());
    echo json_encode(['logged_in' => false]);
}
?>
