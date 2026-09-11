FROM node:22-alpine AS frontend

WORKDIR /src
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build

FROM golang:1.27-alpine AS backend

WORKDIR /src
COPY server/go.mod server/go.sum ./server/
RUN cd server && go mod download
COPY server ./server
RUN cd server && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /kitonynav .

FROM alpine:3.22

WORKDIR /app
RUN addgroup -S kitony && adduser -S kitony -G kitony
COPY --from=frontend /src/dist/client ./dist/client
COPY --from=backend /kitonynav ./kitonynav
RUN mkdir -p /data && chown -R kitony:kitony /app /data

ENV PORT=8080
ENV DATA_DIR=/data
ENV STATIC_DIR=/app/dist/client
ENV COOKIE_SECURE=true

VOLUME ["/data"]
EXPOSE 8080
USER kitony
CMD ["/app/kitonynav"]

