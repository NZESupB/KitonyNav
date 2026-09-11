# KitonyNav

React + Go 导航站原型，包含公开导航、动态聚合和单人后台管理。

## v0.0.2 开发准备

开发分支为 `dev`，当前已接入 v0.0.2 的第一版配置、外观和采集能力，探针闭环与发布验收仍在进行：

- [开发计划与验收标准](docs/v0.0.2-plan.md)
- [技术框架、数据模型与 API 草案](docs/v0.0.2-architecture.md)

## 本地开发

先安装前端依赖：

```bash
npm install
```

启动 Go API（默认 `8080`）：

```bash
cd server
GOPATH=/tmp/kitonynav-go-path GOMODCACHE=/tmp/kitonynav-go-modcache GOCACHE=/tmp/kitonynav-go-cache go run .
```

另开终端启动 Vite：

```bash
npm run dev
```

前端开发服务器会把 `/api` 请求代理到 `http://127.0.0.1:8080`。本地 Go 开发默认密码是 `kitony-dev`；使用 Docker 部署时，先在 `docker-compose.yml` 中把 `ADMIN_PASSWORD` 的占位值改成强密码。

### 可选本机 TCP 探针

需要在主页看到访问设备的真实 TCP 建连结果时，在同一台设备启动探针，并只把允许检测的目标加入 allowlist：

```bash
cd server
go run ./cmd/kitonynav-probe --allow github.com:443,example.com:443
```

探针只监听 `127.0.0.1:4711`，未加入 allowlist 的目标会被拒绝。未启动探针时，主页自动回退到浏览器 HTTP 连通性检测。

## Docker

不需要创建 `.env` 文件，配置直接写在 `docker-compose.yml` 中。启动服务：

```bash
docker compose pull
docker compose up -d
```

Compose 默认使用已发布的 `ghcr.io/nzesupb/kitonynav:latest` 镜像。服务默认监听 `8080`，SQLite 数据保存在 `kitonynav-data` 卷中。正式部署前请编辑 Compose 文件中的 `ADMIN_PASSWORD`；接入 HTTPS 反向代理后，将 `COOKIE_SECURE` 改为 `true`。需要可复现部署时，可将镜像标签改为具体版本，例如 `v0.0.1`。

如果 GHCR 包设置为私有，部署机首次拉取前需要先执行 `docker login ghcr.io`；Public 包可以直接执行上面的命令。

## 自动发布镜像

`.github/workflows/docker-publish.yml` 会在推送形如 `v1.0.0` 的 Git 标签时构建 `linux/amd64` 和 `linux/arm64` 多架构镜像，并发布两个镜像标签到 GitHub Container Registry：

```text
ghcr.io/<GitHub 用户名>/<仓库名>:v1.0.0
ghcr.io/<GitHub 用户名>/<仓库名>:latest
```

GitHub Actions 自带的 `GITHUB_TOKEN` 已足够发布到 GHCR，不需要在本地配置环境变量。也可以在 Actions 的 `workflow_dispatch` 中填写 `registry`、`image` 和 `tag`，发布到其他 Docker/OCI Registry。除 GHCR 外，目标服务必须在仓库 Secrets 中提供 `REGISTRY_USERNAME` 和 `REGISTRY_PASSWORD`，这是远程仓库认证的必要条件。

`image` 只填写仓库路径，例如 Docker Hub 使用 `your-name/kitonynav`，不要重复填写 Registry 主机名。

## 验证

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:sites
cd server && go test ./...
```
