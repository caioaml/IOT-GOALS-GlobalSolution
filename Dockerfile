FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN chmod -R 755 node_modules/.bin

RUN ./node_modules/.bin/tsc

EXPOSE 10000

ENV PORT=10000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
