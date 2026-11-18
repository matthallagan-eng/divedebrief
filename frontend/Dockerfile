FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx:alpine runs envsubst on templates at start, filling in ${PORT}
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=80

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]