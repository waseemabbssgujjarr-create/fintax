FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=8080 FINTAX_DATA=/data
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "server/server.js"]
