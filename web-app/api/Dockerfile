FROM node:22-alpine
WORKDIR /app/api
COPY api/package*.json ./
RUN npm install
COPY api/ ./
COPY database/ /app/database/
RUN npx prisma generate --schema ../database/prisma/schema.prisma && npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push --schema ../database/prisma/schema.prisma && npm run start"]
