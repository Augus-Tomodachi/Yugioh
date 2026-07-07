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
    echo json_encode(['error' => 'Servicio no disponible']);
    exit;
}

$maleta = trim($_GET['maleta'] ?? '');
if (empty($maleta)) {
    echo json_encode(['error' => 'Falta el parámetro maleta']);
    exit;
}

$userId = $_SESSION['user_id'];
$temporada = CURRENT_SEASON_NUMBER;

try {
    // Obtener el mazo guardado
    $stmt = $pdo->prepare("SELECT deck_cards FROM user_decks WHERE user_id = :uid AND maleta = :maleta");
    $stmt->execute([':uid' => $userId, ':maleta' => $maleta]);
    $row = $stmt->fetch();

    $cards = [];
    if ($row) {
        $cards = json_decode($row['deck_cards'], true) ?: [];
    }

    // Obtener las cartas iniciales del usuario en esta temporada
    $stmt2 = $pdo->prepare("SELECT ci.nombre FROM cartas_iniciales ci
                            JOIN user_starter_cards usc ON ci.id = usc.card_id
                            WHERE usc.user_id = :uid AND usc.temporada = :temp");
    $stmt2->execute([':uid' => $userId, ':temp' => $temporada]);
    $starterNames = $stmt2->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'cards' => $cards,
        'count' => count($cards),
        'starter_card_names' => $starterNames
    ]);
} catch (PDOException $e) {
    error_log("Load deck error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al cargar el mazo']);
}
?>
