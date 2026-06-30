FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/admin-web/package*.json ./apps/admin-web/
COPY libs/shared/package*.json ./libs/shared/

RUN npm ci

COPY apps/admin-web ./apps/admin-web
COPY libs/shared ./libs/shared

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=@equuscronos/shared
RUN npm run build --workspace=admin-web

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=admin-web", "--", "-p", "3001"]
