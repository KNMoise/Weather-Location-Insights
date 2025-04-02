server {
    listen 80;
    server_name server_ip_address;

    root /var/www/weather-app;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}