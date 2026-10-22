# Build từ thư mục gốc repo: docker compose build api
FROM node:22-alpine AS build
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci
COPY api/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app/api
ENV NODE_ENV=production
COPY api/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/api/dist ./dist
COPY db /app/db
EXPOSE 3000
# Chạy migration (và seed nếu RUN_SEED=true) trước khi mở API.
CMD ["sh", "-c", "node dist/db/migrate.js && if [ \"$RUN_SEED\" = \"true\" ]; then node dist/db/seed.js; fi && node dist/server.js"]
