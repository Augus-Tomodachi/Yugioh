#!/bin/bash
set -e

echo "🚀 Iniciando servidor..."

# Crear directorios necesarios
mkdir -p /var/log/nginx
mkdir -p /var/run/php

# Iniciar PHP-FPM
echo "📦 Iniciando PHP-FPM..."
php-fpm -D --fpm-config /etc/php/8.2/fpm/php-fpm.conf

# Iniciar Nginx
echo "🌐 Iniciando Nginx en puerto ${PORT:-80}..."
nginx -g "daemon off;"