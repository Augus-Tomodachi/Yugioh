<?php
require 'config.php';
header('Content-Type: application/json; charset=utf-8');

// Verificar si la sesión está activa
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['logged_in' => false]);
    exit;
}

// Verificar tiempo de inactividad (30 minutos)
$maxInactivity = 1800; // 30 minutos en segundos
if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $maxInactivity)) {
    // Sesión expirada
    session_unset();
    session_destroy();
    echo json_encode(['logged_in' => false]);
    exit;
}

// Actualizar tiempo de actividad
$_SESSION['last_activity'] = time();

try {
    $stmt = $pdo->prepare("SELECT id, nombre, vidas, maleta FROM usuarios WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if ($user) {
        echo json_encode([
            'logged_in' => true,
            'user' => [
                'id' => $user['id'],
                'nombre' => $user['nombre'],
                'vidas' => (int)$user['vidas'],
                'maleta' => $user['maleta']
            ]
        ]);
    } else {
        // Usuario no encontrado
        session_destroy();
        echo json_encode(['logged_in' => false]);
    }
} catch (PDOException $e) {
    error_log("Error en session: " . $e->getMessage());
    echo json_encode(['logged_in' => false]);
}
?>