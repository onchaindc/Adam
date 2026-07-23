# syntax=docker/dockerfile:1.7

FROM node:26.5.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/contracts packages/contracts
COPY scripts scripts
RUN pnpm verify

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --prod --frozen-lockfile

FROM node:26.5.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
ENV STATE_FILE=/data/runtime-state.json
WORKDIR /app
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git gosu \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system adam \
  && useradd --system --gid adam --home /app adam \
  && mkdir -p /data \
  && chown -R adam:adam /app /data
COPY --from=production-dependencies --chown=adam:adam /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=adam:adam /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=adam:adam /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=adam:adam /app/packages/contracts/dist ./packages/contracts/dist
COPY --chown=adam:adam package.json ./
COPY --chown=adam:adam apps/api/package.json apps/api/package.json
COPY --chown=adam:adam packages/contracts/package.json packages/contracts/package.json
COPY docker-entrypoint.sh /usr/local/bin/adam-entrypoint
RUN chmod 755 /usr/local/bin/adam-entrypoint
EXPOSE 4000
ENTRYPOINT ["adam-entrypoint"]
CMD ["node", "apps/api/dist/server.js"]
