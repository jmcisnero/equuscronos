FROM nginx:alpine

# Copy the static website files into the default nginx public folder
COPY apps/web-informativa/index.html /usr/share/nginx/html/index.html
COPY apps/web-informativa/images /usr/share/nginx/html/images

EXPOSE 80
