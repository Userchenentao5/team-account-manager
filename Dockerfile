FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

RUN sed -i \
      -e 's|deb.debian.org|mirrors.cloud.aliyuncs.com|g' \
      -e 's|security.debian.org|mirrors.cloud.aliyuncs.com|g' \
      /etc/apt/sources.list.d/debian.sources \
  && apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN mkdir -p data && npm run db:migrate && npm run build

FROM node:24.18.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run start"]
