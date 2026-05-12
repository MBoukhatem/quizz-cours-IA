FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/core/package.json ./packages/core/
COPY packages/cli/package.json ./packages/cli/
RUN pnpm install --frozen-lockfile --filter @quizz/core... --filter @quizz/cli

FROM deps AS runtime
COPY tsconfig.base.json ./
COPY packages/core ./packages/core
COPY packages/cli ./packages/cli
CMD ["pnpm", "--filter", "@quizz/cli", "start"]
