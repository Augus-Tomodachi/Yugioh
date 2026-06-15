<?php
require 'config.php';
header('Content-Type: application/json; charset=utf-8');

// Verificar autenticación
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Debes iniciar sesión']);
    exit;
}

// Solo aceptar GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

$maleta = trim($_GET['maleta'] ?? '');

if (empty($maleta)) {
    echo json_encode(['error' => 'Falta el parámetro maleta']);
    exit;
}

try {
    $stmt = $pdo->prepare(
        "SELECT deck_cards FROM user_decks WHERE user_id = :user_id AND maleta = :maleta"
    );
    $stmt->execute([
        ':user_id' => $_SESSION['user_id'],
        ':maleta' => $maleta
    ]);
    
    $row = $stmt->fetch();

    if ($row) {
        $cards = json_decode($row['deck_cards'], true);
        echo json_encode([
            'cards' => $cards ?: [],
            'count' => count($cards ?: [])
        ]);
    } else {
        echo json_encode([
            'cards' => [],
            'count' => 0
        ]);
    }
} catch (PDOException $e) {
    error_log("Error en load_deck: " . $e->getMessage());
    echo json_encode(['error' => 'Error al cargar el mazo']);
}
?>