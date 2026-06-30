FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/public-web/package*.json ./apps/public-web/
COPY libs/shared/package*.json ./libs/shared/

RUN npm ci

COPY apps/public-web ./apps/public-web
COPY libs/shared ./libs/shared

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=@equuscronos/shared
RUN npm run build --workspace=public-web

EXPOSE 3002

CMD ["npm", "run", "start", "--workspace=public-web", "--", "-p", "3002"]
