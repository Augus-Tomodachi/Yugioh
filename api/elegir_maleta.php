<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Debes iniciar sesión']);
    exit;
}

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
$maleta = trim($input['maleta'] ?? '');

if (empty($maleta)) {
    echo json_encode(['error' => 'Debes seleccionar una maleta']);
    exit;
}

try {
    // Verificar temporada actual
    $stmt = $pdo->prepare("SELECT id FROM seasons WHERE numero = :num");
    $stmt->execute([':num' => CURRENT_SEASON_NUMBER]);
    $season = $stmt->fetch();
    if (!$season) {
        echo json_encode(['error' => 'Temporada no configurada']);
        exit;
    }

    // Validar que la maleta exista en esta temporada
    $stmt = $pdo->prepare("SELECT 1 FROM season_maletas WHERE season_id = :sid AND maleta = :maleta");
    $stmt->execute([':sid' => $season['id'], ':maleta' => $maleta]);
    if (!$stmt->fetch()) {
        echo json_encode(['error' => 'Maleta no disponible en esta temporada']);
        exit;
    }

    // Verificar si ya eligió
    $stmt = $pdo->prepare("SELECT maleta FROM user_maleta_choices WHERE user_id = :uid AND season_id = :sid");
    $stmt->execute([':uid' => $_SESSION['user_id'], ':sid' => $season['id']]);
    if ($stmt->fetch()) {
        echo json_encode(['error' => 'Ya has elegido una maleta para esta temporada']);
        exit;
    }

    // Transacción: registrar elección y actualizar usuario
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO user_maleta_choices (user_id, season_id, maleta) VALUES (:uid, :sid, :maleta)");
        $stmt->execute([':uid' => $_SESSION['user_id'], ':sid' => $season['id'], ':maleta' => $maleta]);

        $stmt = $pdo->prepare("UPDATE usuarios SET maleta = :maleta WHERE id = :uid");
        $stmt->execute([':maleta' => $maleta, ':uid' => $_SESSION['user_id']]);

        $pdo->commit();
        echo json_encode(['success' => true, 'maleta' => $maleta]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    error_log("Elegir maleta error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al elegir la maleta']);
}
?>
