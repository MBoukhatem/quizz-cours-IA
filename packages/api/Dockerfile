FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/api ./packages/api
RUN pnpm -C packages/core build && pnpm -C packages/api build

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
RUN apk add --no-cache python3 make g++ libstdc++
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --frozen-lockfile --prod --filter @quizz/api...
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/api/dist  ./packages/api/dist
EXPOSE 8080
CMD ["node", "packages/api/dist/index.js"]
