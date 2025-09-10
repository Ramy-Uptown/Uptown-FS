FROM node:20-alpine

# Install LibreOffice and basic fonts for PDF rendering
RUN apk add --no-cache \
    libreoffice \
    ttf-dejavu \
    font-noto \
    font-noto-cjk \
    font-noto-emoji

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]