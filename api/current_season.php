<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

// Datos de temporada desde la base de datos (si está disponible)
$season = null;
$maletas = [];

if ($pdo) {
    try {
        $stmt = $pdo->prepare("SELECT id, numero FROM seasons WHERE numero = :numero");
        $stmt->execute([':numero' => CURRENT_SEASON_NUMBER]);
        $season = $stmt->fetch();

        if ($season) {
            $stmt = $pdo->prepare("SELECT maleta FROM season_maletas WHERE season_id = :sid ORDER BY maleta");
            $stmt->execute([':sid' => $season['id']]);
            $maletas = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
    } catch (PDOException $e) {
        error_log("Season query error: " . $e->getMessage());
    }
}

// Si no hay base de datos o no se encontró la temporada, usamos valores por defecto
if (!$season) {
    // Temporada hardcodeada (debe coincidir con cartas.json y el frontend)
    $season = ['id' => CURRENT_SEASON_NUMBER, 'numero' => CURRENT_SEASON_NUMBER];
    $maletas = ['Maleta Cobalto', 'Maleta Purpura', 'Maleta Cobre'];
}

$response = [
    'season' => $season,
    'maletas' => $maletas
];

// Elección del usuario en esta temporada (si está autenticado y hay DB)
if (isset($_SESSION['user_id']) && $pdo) {
    try {
        $stmt = $pdo->prepare("SELECT maleta FROM user_maleta_choices WHERE user_id = :uid AND season_id = :sid");
        $stmt->execute([':uid' => $_SESSION['user_id'], ':sid' => $season['id']]);
        $response['user_choice'] = $stmt->fetchColumn() ?: null;
    } catch (PDOException $e) {
        $response['user_choice'] = null;
    }
} else {
    $response['user_choice'] = null;
}

echo json_encode($response);
?>
