# AWS ECR Public mirror of the official node image — avoids Docker Hub pull rate limits
# on shared CI builders (the "load metadata"/toomanyrequests failure). Same image bytes.
FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npx ponder codegen
# No ENV PORT / EXPOSE — SnapDeploy injects $PORT and Ponder reads it.
# Needs DATABASE_URL (Postgres add-on) and PONDER_RPC_URL_84532 set in the platform env.
EXPOSE 42069
CMD ["npm", "run", "start"]
