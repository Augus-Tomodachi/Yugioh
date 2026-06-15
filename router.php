<?php
// router.php - Maneja peticiones para PHP built-in server

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Servir archivos PHP
if (pathinfo($uri, PATHINFO_EXTENSION) === 'php') {
    $filepath = __DIR__ . $uri;
    if (file_exists($filepath)) {
        require $filepath;
        return true;
    }
}

// Servir archivos estáticos
$filepath = __DIR__ . $uri;
if (file_exists($filepath) && is_file($filepath)) {
    return false; // Dejar que PHP maneje el archivo
}

// Si es directorio o raíz, servir index.html
if ($uri === '/' || is_dir($filepath)) {
    header('Content-Type: text/html');
    readfile(__DIR__ . '/index.html');
    return true;
}

// 404
http_response_code(404);
echo json_encode(['error' => 'Not found: ' . $uri]);
?>