<?php
header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'PGHOST'     => getenv('PGHOST') ?: 'NO ENCONTRADA',
    'PGPORT'     => getenv('PGPORT') ?: 'NO ENCONTRADA',
    'PGDATABASE' => getenv('PGDATABASE') ?: 'NO ENCONTRADA',
    'PGUSER'     => getenv('PGUSER') ?: 'NO ENCONTRADA',
    'PGPASSWORD' => getenv('PGPASSWORD') ? 'CONFIGURADA' : 'NO ENCONTRADA',
    'PHP_VERSION' => phpversion(),
]);
?>
