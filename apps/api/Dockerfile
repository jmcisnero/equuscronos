FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY libs/shared/package*.json ./libs/shared/

RUN npm ci

COPY apps/api ./apps/api
COPY libs/shared ./libs/shared

RUN npm run build --workspace=@equuscronos/shared
RUN npm run build --workspace=@equuscronos/api

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY libs/shared/package*.json ./libs/shared/

RUN npm ci --only=production

COPY --from=builder /usr/src/app/libs/shared/dist ./libs/shared/dist
COPY --from=builder /usr/src/app/apps/api/dist ./apps/api/dist

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
