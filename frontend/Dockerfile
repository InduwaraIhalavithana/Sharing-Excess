# Stage 1 – build the React/Vite app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# API_BASE = "" → all API calls are relative; nginx proxies /api/* to the backend
ARG VITE_API_BASE_URL=""
ARG VITE_APP_ROOT_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_ROOT_URL=$VITE_APP_ROOT_URL

RUN npx vite build

# Stage 2 – serve with nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
