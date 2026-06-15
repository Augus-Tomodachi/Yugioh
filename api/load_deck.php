<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Debes iniciar sesión']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode(['error' => 'Servicio no disponible (sin base de datos)']);
    exit;
}

$maleta = trim($_GET['maleta'] ?? '');
if (empty($maleta)) {
    echo json_encode(['error' => 'Falta el parámetro maleta']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT deck_cards FROM user_decks WHERE user_id = :uid AND maleta = :maleta");
    $stmt->execute([':uid' => $_SESSION['user_id'], ':maleta' => $maleta]);
    $row = $stmt->fetch();

    if ($row) {
        $cards = json_decode($row['deck_cards'], true) ?: [];
        echo json_encode(['cards' => $cards, 'count' => count($cards)]);
    } else {
        echo json_encode(['cards' => [], 'count' => 0]);
    }
} catch (PDOException $e) {
    error_log("Load deck error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al cargar el mazo']);
}
?>
