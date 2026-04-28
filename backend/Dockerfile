FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

RUN mkdir -p /data
VOLUME ["/data"]

ENV DATA_DIR=/data
ENV PORT=3001

EXPOSE 3001
CMD ["node", "index.js"]
