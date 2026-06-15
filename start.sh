#!/bin/bash
set -e

echo "🚀 Iniciando servidor..."

# Verificar PHP
echo "📋 PHP disponibles:"
which php
which php-fpm

# Crear directorios necesarios
mkdir -p /tmp/php
mkdir -p /var/log/nginx
mkdir -p /var/lib/nginx

# Configurar PHP-FPM
PHP_FPM=$(which php-fpm)
if [ -n "$PHP_FPM" ]; then
    echo "✅ PHP-FPM encontrado en: $PHP_FPM"
    
    # Crear configuración de PHP-FPM
    cat > /tmp/php-fpm.conf << 'EOF'
[global]
pid = /tmp/php-fpm.pid
error_log = /tmp/php-fpm.log

[www]
listen = /tmp/php-fpm.sock
listen.mode = 0666
user = root
group = root
pm = dynamic
pm.max_children = 5
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 3
EOF

    echo "📦 Iniciando PHP-FPM..."
    $PHP_FPM -y /tmp/php-fpm.conf -D
    
    # Verificar que inició
    sleep 1
    if [ -S /tmp/php-fpm.sock ]; then
        echo "✅ PHP-FPM corriendo"
    else
        echo "⚠️ PHP-FPM no inició correctamente"
    fi
fi

# Configurar Nginx
cat > /tmp/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    keepalive_timeout 65;
    
    access_log /dev/stdout;
    error_log /dev/stderr;

    server {
        listen ${PORT:-8080};
        server_name _;
        root /app;

        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

        if (\$request_method = 'OPTIONS') {
            return 204;
        }

        # API PHP
        location /api/ {
            fastcgi_pass unix:/tmp/php-fpm.sock;
            fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
            include fastcgi_params;
            fastcgi_read_timeout 300;
        }

        # Archivos estáticos
        location / {
            try_files \$uri \$uri/ /index.html;
        }
    }
}
EOF

echo "🌐 Iniciando Nginx en puerto ${PORT:-8080}..."
nginx -c /tmp/nginx.conf -g "daemon off;"
