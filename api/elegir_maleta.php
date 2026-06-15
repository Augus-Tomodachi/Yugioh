<?php
require 'config.php';
header('Content-Type: application/json; charset=utf-8');

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Debes iniciar sesión']);
    exit;
}

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['maleta'])) {
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

$maleta = trim($data['maleta']);

if (empty($maleta)) {
    echo json_encode(['error' => 'Debes seleccionar una maleta']);
    exit;
}

try {
    // Obtener el ID de la temporada actual
    $stmt = $pdo->prepare("SELECT id FROM seasons WHERE numero = :numero");
    $stmt->execute([':numero' => CURRENT_SEASON_NUMBER]);
    $season = $stmt->fetch();

    if (!$season) {
        echo json_encode(['error' => 'Temporada no configurada']);
        exit;
    }

    // Validar que la maleta pertenezca a la temporada actual
    $stmt = $pdo->prepare(
        "SELECT 1 FROM season_maletas WHERE season_id = :season_id AND maleta = :maleta"
    );
    $stmt->execute([
        ':season_id' => $season['id'],
        ':maleta' => $maleta
    ]);
    
    if (!$stmt->fetch()) {
        echo json_encode(['error' => 'Maleta no disponible en esta temporada']);
        exit;
    }

    // Verificar si ya eligió en esta temporada
    $stmt = $pdo->prepare(
        "SELECT maleta FROM user_maleta_choices WHERE user_id = :user_id AND season_id = :season_id"
    );
    $stmt->execute([
        ':user_id' => $_SESSION['user_id'],
        ':season_id' => $season['id']
    ]);
    
    if ($stmt->fetch()) {
        echo json_encode(['error' => 'Ya has elegido una maleta para esta temporada']);
        exit;
    }

    // Iniciar transacción
    $pdo->beginTransaction();

    try {
        // Registrar la elección
        $stmt = $pdo->prepare(
            "INSERT INTO user_maleta_choices (user_id, season_id, maleta) VALUES (:user_id, :season_id, :maleta)"
        );
        $stmt->execute([
            ':user_id' => $_SESSION['user_id'],
            ':season_id' => $season['id'],
            ':maleta' => $maleta
        ]);

        // Actualizar maleta activa del usuario
        $stmt = $pdo->prepare("UPDATE usuarios SET maleta = :maleta WHERE id = :user_id");
        $stmt->execute([
            ':maleta' => $maleta,
            ':user_id' => $_SESSION['user_id']
        ]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'maleta' => $maleta,
            'season_numero' => CURRENT_SEASON_NUMBER
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
} catch (PDOException $e) {
    error_log("Error en elegir_maleta: " . $e->getMessage());
    echo json_encode(['error' => 'Error al elegir la maleta']);
}
?>