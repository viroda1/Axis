FROM nginx:alpine
COPY . /usr/share/nginx/html

RUN echo 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location = /sw.js {\n\
        add_header Cache-Control "no-store, no-cache, must-revalidate";\n\
        add_header Service-Worker-Allowed "/";\n\
        types { }\n\
        default_type application/javascript;\n\
    }\n\
\n\
    location ~* \.(js|mjs|wasm)$ {\n\
        add_header Cache-Control "public, max-age=31536000, immutable";\n\
    }\n\
\n\
    location ~* \.(css|png|svg|ico|woff2)$ {\n\
        add_header Cache-Control "public, max-age=31536000, immutable";\n\
    }\n\
\n\
    location ~* \.(html)$ {\n\
        add_header Cache-Control "no-cache";\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
