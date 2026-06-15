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
$cards = $input['cards'] ?? [];

if (empty($maleta) || !is_array($cards)) {
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

try {
    $stmt = $pdo->prepare("INSERT INTO user_decks (user_id, maleta, deck_cards)
                           VALUES (:uid, :maleta, :cards::jsonb)
                           ON CONFLICT (user_id, maleta)
                           DO UPDATE SET deck_cards = EXCLUDED.deck_cards");
    $stmt->execute([
        ':uid' => $_SESSION['user_id'],
        ':maleta' => $maleta,
        ':cards' => json_encode($cards)
    ]);

    echo json_encode(['success' => true, 'message' => 'Mazo guardado']);
} catch (PDOException $e) {
    error_log("Save deck error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al guardar el mazo']);
}
?>
