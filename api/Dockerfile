# Base stage for both development and production
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Development stage (no LibreOffice)
FROM base AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage (with LibreOffice)
FROM base AS production
RUN apk add --no-cache \
    libreoffice \
    ttf-dejavu \
    fontconfig
COPY . .
EXPOSE 3000
CMD ["npm", "start"]