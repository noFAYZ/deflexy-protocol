# AWS ECR Public mirror of the official node image — avoids Docker Hub pull rate limits
# on shared CI builders (the "load metadata"/toomanyrequests failure). Same image bytes.
FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx ponder codegen
# Ponder listens on 42069 (or $PORT). Needs DATABASE_URL (a DIRECT/unpooled Postgres URL),
# DATABASE_SCHEMA, and PONDER_RPC_URL_84532 set in the platform env or it crashes on boot.
EXPOSE 42069
CMD ["npm", "run", "start"]
