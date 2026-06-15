<?php
require 'config.php';
header('Content-Type: application/json; charset=utf-8');

try {
    // Obtener temporada actual por número
    $stmt = $pdo->prepare("SELECT id, numero FROM seasons WHERE numero = :numero");
    $stmt->execute([':numero' => CURRENT_SEASON_NUMBER]);
    $season = $stmt->fetch();

    if (!$season) {
        echo json_encode(['error' => 'Temporada no encontrada']);
        exit;
    }

    // Obtener maletas de esta temporada
    $stmt = $pdo->prepare("SELECT maleta FROM season_maletas WHERE season_id = :season_id ORDER BY maleta");
    $stmt->execute([':season_id' => $season['id']]);
    $maletas = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $response = [
        'season' => [
            'id' => (int)$season['id'],
            'numero' => (int)$season['numero']
        ],
        'maletas' => $maletas
    ];

    // Si hay usuario autenticado, verificar su elección en esta temporada
    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare(
            "SELECT maleta FROM user_maleta_choices WHERE user_id = :user_id AND season_id = :season_id"
        );
        $stmt->execute([
            ':user_id' => $_SESSION['user_id'],
            ':season_id' => $season['id']
        ]);
        $choice = $stmt->fetchColumn();
        $response['user_choice'] = $choice ?: null;
    }

    echo json_encode($response);
} catch (PDOException $e) {
    error_log("Error en current_season: " . $e->getMessage());
    echo json_encode(['error' => 'Error al obtener la temporada actual']);
}
?>