<?php
// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Si es un archivo PHP en /api/
if (strpos($uri, '/api/') === 0 && pathinfo($uri, PATHINFO_EXTENSION) === 'php') {
    $file = __DIR__ . $uri;
    if (file_exists($file)) {
        if (session_status() === PHP_SESSION_NONE) session_start();
        require $file;
        return true;
    }
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API endpoint not found']);
    return true;
}

// Archivos estáticos (dejar que PHP los sirva)
$file = __DIR__ . $uri;
if (file_exists($file) && is_file($file)) {
    return false;  // PHP built-in server sirve el archivo automáticamente
}

// Ruta por defecto: index.html
header('Content-Type: text/html');
readfile(__DIR__ . '/index.html');
return true;
