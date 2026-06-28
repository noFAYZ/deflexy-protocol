# AWS ECR Public mirror of the official node image — avoids Docker Hub pull rate limits
# on shared CI builders (the "load metadata"/toomanyrequests failure). Same image bytes.
FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# No ENV PORT / EXPOSE — SnapDeploy injects $PORT and the app reads process.env.PORT.
# data/refs.json is the ref→CID map; on this platform the disk is ephemeral (see DEPLOY.md).
CMD ["npm", "run", "start"]
