FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile --filter @quizz/web

COPY tsconfig.base.json ./
COPY packages/web ./packages/web

ENV VITE_API_BASE_URL=/api
RUN pnpm --filter @quizz/web exec vite build

FROM nginx:alpine AS runtime
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
