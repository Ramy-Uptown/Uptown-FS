FROM node:20-alpine

# Install LibreOffice and fonts for proper PDF rendering
RUN apk add --no-cache \
    libreoffice \
    ttf-dejavu \
    fontconfig

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]