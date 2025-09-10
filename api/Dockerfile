FROM node:20-alpine

WORKDIR /app

# System dependencies for LibreOffice-based DOCX -> PDF conversion and fonts
RUN apk add --no-cache \
    libreoffice \
    ttf-dejavu \
    fontconfig

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]