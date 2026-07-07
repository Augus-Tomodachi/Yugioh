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
    echo json_encode(['error' => 'Servicio no disponible']);
    exit;
}

$userId = $_SESSION['user_id'];
$temporada = CURRENT_SEASON_NUMBER;

// Verificar si ya se asignaron cartas en esta temporada
$stmt = $pdo->prepare("SELECT COUNT(*) FROM user_starter_cards WHERE user_id = :uid AND temporada = :temp");
$stmt->execute([':uid' => $userId, ':temp' => $temporada]);
if ($stmt->fetchColumn() > 0) {
    echo json_encode(['success' => false, 'message' => 'Ya tienes cartas iniciales asignadas en esta temporada']);
    exit;
}

// Obtener maleta actual del usuario
$stmt = $pdo->prepare("SELECT maleta FROM usuarios WHERE id = :uid");
$stmt->execute([':uid' => $userId]);
$maleta = $stmt->fetchColumn();
if (!$maleta) {
    echo json_encode(['error' => 'Primero debes elegir una maleta']);
    exit;
}

try {
    $pdo->beginTransaction();

    // Seleccionar 1 carta aleatoria de cada tipo para esta temporada
    $tipos = ['magia', 'trampa', 'monstruo'];
    $selectedCards = [];

    foreach ($tipos as $tipo) {
        $stmt = $pdo->prepare("SELECT id, nombre FROM cartas_iniciales WHERE tipo = :tipo AND temporada = :temp ORDER BY RANDOM() LIMIT 1");
        $stmt->execute([':tipo' => $tipo, ':temp' => $temporada]);
        $card = $stmt->fetch();
        if ($card) {
            $selectedCards[] = $card;
            // Registrar asignación
            $stmtInsert = $pdo->prepare("INSERT INTO user_starter_cards (user_id, card_id, temporada) VALUES (:uid, :cid, :temp) ON CONFLICT DO NOTHING");
            $stmtInsert->execute([':uid' => $userId, ':cid' => $card['id'], ':temp' => $temporada]);
        }
    }

    if (count($selectedCards) !== 3) {
        $pdo->rollBack();
        echo json_encode(['error' => 'No se encontraron cartas suficientes para esta temporada']);
        exit;
    }

    // Leer el mazo actual del usuario para esta maleta
    $stmt = $pdo->prepare("SELECT deck_cards FROM user_decks WHERE user_id = :uid AND maleta = :maleta");
    $stmt->execute([':uid' => $userId, ':maleta' => $maleta]);
    $row = $stmt->fetch();
    $currentDeck = $row ? json_decode($row['deck_cards'], true) : [];
    if (!is_array($currentDeck)) $currentDeck = [];

    // Agregar las cartas nuevas (evitar duplicados)
    $newNames = array_column($selectedCards, 'nombre');
    $updatedDeck = $currentDeck;
    foreach ($newNames as $name) {
        if (!in_array($name, $updatedDeck)) {
            $updatedDeck[] = $name;
        }
    }

    // Guardar el mazo actualizado
    $stmt = $pdo->prepare("INSERT INTO user_decks (user_id, maleta, deck_cards) VALUES (:uid, :maleta, :cards::jsonb)
                           ON CONFLICT (user_id, maleta) DO UPDATE SET deck_cards = EXCLUDED.deck_cards");
    $stmt->execute([
        ':uid' => $userId,
        ':maleta' => $maleta,
        ':cards' => json_encode($updatedDeck)
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'cards_assigned' => $newNames,
        'deck_updated' => true
    ]);
} catch (Exception $e) {
    $pdo->rollBack();
    error_log("Assign starter cards error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error al asignar cartas iniciales']);
}
?>
