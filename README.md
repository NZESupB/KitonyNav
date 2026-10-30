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

### 网络连通性与延迟测试

KitonyNav 采用纯前端轻量探测架构（Fetch no-cors + Ping-via-Image 回退），跨 PC 与移动端开箱即用，无需在访问设备上安装任何常驻探针程序或后台服务。
卡片右侧直接展示访问当前网站的端到端真实往返延迟毫秒值，状态颜色区分（良好/适中/较慢），无冗余前缀，清晰干练。

**裸域名 TLS 排查：**若 `nxnow.top` 证书主机名不匹配而 `www.nxnow.top` 正常，先为裸域名配置有效证书及 nginx `server_name nxnow.top`，再设置 `return 308 https://www.nxnow.top$request_uri;`。TLS 握手先于跳转，仅增加重定向不能修复证书。证书路径需按实际部署确定；修复后不跳过证书校验，验证裸域名 308、www 最终 200。这与本机探针连接是独立问题。

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
