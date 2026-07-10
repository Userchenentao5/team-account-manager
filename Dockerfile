FROM node:25.5.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM node:25.5.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
