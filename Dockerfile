ARG VCS_REF=unknown

FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN mkdir -p data && npm run db:migrate && npm run build

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM node:24.18.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ARG VCS_REF
LABEL org.opencontainers.image.revision=$VCS_REF
LABEL org.opencontainers.image.source=https://github.com/Userchenentao5/team-account-manager

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
