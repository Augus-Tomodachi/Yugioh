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

if (!$data || !isset($data['maleta']) || !isset($data['cards'])) {
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

$maleta = trim($data['maleta']);
$cards = $data['cards'];

if (empty($maleta)) {
    echo json_encode(['error' => 'Maleta no especificada']);
    exit;
}

if (!is_array($cards)) {
    echo json_encode(['error' => 'El formato de las cartas no es válido']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        "INSERT INTO user_decks (user_id, maleta, deck_cards)
         VALUES (:user_id, :maleta, :cards::jsonb)
         ON CONFLICT (user_id, maleta)
         DO UPDATE SET deck_cards = EXCLUDED.deck_cards"
    );
    
    $stmt->execute([
        ':user_id' => $_SESSION['user_id'],
        ':maleta' => $maleta,
        ':cards' => json_encode($cards)
    ]);

    echo json_encode([
        'success' => true,
        'message' => 'Mazo guardado correctamente',
        'cards_count' => count($cards)
    ]);
} catch (PDOException $e) {
    error_log("Error en save_deck: " . $e->getMessage());
    echo json_encode(['error' => 'Error al guardar el mazo']);
}
?>