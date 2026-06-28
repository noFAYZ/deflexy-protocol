# AWS ECR Public mirror of the official node image — avoids Docker Hub pull rate limits
# on shared CI builders (the "load metadata"/toomanyrequests failure). Same image bytes.
FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# The platform needs this to know which port to route traffic to.
# If it injects $PORT at runtime, your app's process.env.PORT will still
# override this — but the EXPOSE is required to pass deployment validation.
EXPOSE 3000

CMD ["npm", "run", "start"]