#!/bin/bash
set -e

echo "🚀 Iniciando servidor..."

# Verificar qué PHP está disponible
echo "📋 PHP disponibles:"
which php || echo "No php found"
which php-fpm || echo "No php-fpm found"
ls /usr/bin/php* 2>/dev/null || echo "No PHP binaries"
ls /usr/sbin/php* 2>/dev/null || echo "No PHP sbin"

# Buscar php-fpm
PHP_FPM=$(find / -name "php-fpm*" -type f 2>/dev/null | head -1)

if [ -z "$PHP_FPM" ]; then
    echo "⚠️ PHP-FPM no encontrado, buscando alternativas..."
    
    # Intentar con diferentes versiones
    for version in 8.3 8.2 8.1 8.0; do
        if [ -f "/usr/sbin/php-fpm${version}" ]; then
            PHP_FPM="/usr/sbin/php-fpm${version}"
            break
        fi
        if [ -f "/usr/bin/php-fpm${version}" ]; then
            PHP_FPM="/usr/bin/php-fpm${version}"
            break
        fi
    done
fi

if [ -n "$PHP_FPM" ]; then
    echo "✅ PHP-FPM encontrado en: $PHP_FPM"
    
    # Crear directorios necesarios
    mkdir -p /var/log/nginx
    mkdir -p /var/run/php
    
    # Iniciar PHP-FPM
    echo "📦 Iniciando PHP-FPM..."
    $PHP_FPM -D --fpm-config /etc/php/php-fpm.conf 2>/dev/null || \
    $PHP_FPM -D 2>/dev/null || \
    echo "⚠️ No se pudo iniciar PHP-FPM"
else
    echo "❌ PHP-FPM no disponible, usando PHP built-in server"
fi

# Iniciar Nginx si existe
if command -v nginx &> /dev/null; then
    echo "🌐 Iniciando Nginx en puerto ${PORT:-80}..."
    nginx -g "daemon off;"
else
    echo "❌ Nginx no encontrado, usando PHP built-in server"
    php -S 0.0.0.0:${PORT:-80} -t /app /app/router.php
fi
