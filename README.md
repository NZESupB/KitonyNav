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

网站服务与设备探针是两个进程。要显示访问设备的真实 TCP 延迟，请在访问网页的同一台设备安装 Go、取得项目源码，并在项目根目录启动探针：

```bash
go -C server run ./cmd/kitonynav-probe \
  --allow 'github.com:443,www.baidu.com:443' \
  --origins 'http://127.0.0.1:5173,http://localhost:5173,https://www.nxnow.top'
```

此示例只授权两个目标。在主页“本机探针”面板中查看完整去重目标、缺失的白名单项、实际地址与网页来源，可复制包含当前目标的启动命令。先核对目标再在 POSIX shell（macOS/Linux/Windows Git Bash）运行。`--origins` 是允许访问探针的网页来源，`--allow` 是允许拨号的目标，两者不能互相替代；新增目标后需要更新参数并重启探针。

- 默认监听 `http://127.0.0.1:4711`，`--listen` 只接受回环 IP 或 localhost。面板可保存其他回环端口，但不接受远端地址。内置探针提供 HTTP；HTTPS 回环地址需要自行配置可信 TLS 终端。
- 地址仅保存在当前网页来源的设备 localStorage。localhost、127.0.0.1、线上 www 站点彼此独立。旧 `kitony-probe-url` 有效地址继续使用，非法值明确报错，可“恢复默认”。存储不可用时仅当前页面生效。
- 网页与探针需要配套升级。新 `/healthz` 必须含 `service: kitonynav-probe`、`protocolVersion: 1` 和 `allowedTargets`；旧版仅有 `status: ok` 时提示升级。网站服务器的 `/healthz` 不能替代设备探针。
- 点击“保存并连接 / 重试”后，允许浏览器（必要时包括系统）的本地网络访问提示；手动连接最多等待 30 秒，后台健康检查 3 秒，TCP 请求 6.5 秒，探针拨号 5 秒。保存地址或重试会立即检测，无需等待 60 秒轮询。
- 进程退出或设备重启后需要重新启动探针。本项目不自动安装系统常驻服务；Docker 网站容器不会在访问者设备启动探针。
- 数值仅来自访问设备 TCP 拨号（含 DNS），`0ms` 有效；失败不造数值，断开后历史值标“上次”。Go TCP 使用设备路由，与浏览器 HTTP/SOCKS 代理可能不同，不等同于网页加载耗时；代理应绕过回环地址。

在运行探针的设备执行以下诊断（保留证书校验，不使用 `curl -k`）：

```bash
curl --noproxy '*' -i http://127.0.0.1:4711/healthz
curl --noproxy '*' -i -H 'Origin: https://www.nxnow.top' http://127.0.0.1:4711/healthz
curl --noproxy '*' -i 'http://127.0.0.1:4711/tcping?host=github.com&port=443'
curl --noproxy '*' -i -X OPTIONS \
  -H 'Origin: https://www.nxnow.top' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Private-Network: true' \
  http://127.0.0.1:4711/healthz
```

| 观察 | 排查与验收 |
| --- | --- |
| 连接被拒绝 | 启动设备探针并核对地址/端口。只启动 Vite 或网站 Docker 不够。 |
| 带 Origin 返回 403 | 把浏览器 `location.origin` 原样加入 `--origins`；浏览器通常只给出通用 CORS 错误，curl 可读到拒绝原因。 |
| `/tcping` 返回 403 | 将该精确 host:port 加入 `--allow`；这不是网站宕机。 |
| CLI 成功但浏览器失败 | 检查站点本地网络权限、系统权限、控制台 CORS/混合内容/CSP 诊断及代理。旧 PNA 预检允许头不替代当前浏览器权限。 |
| 协议不匹配 | 升级探针或修正地址，避免连到网站 API 的健康接口。 |
| 正常 | 本地开发页和线上页的 Network 都请求本机 `/healthz`、`/tcping`，卡片数值等于响应 `latencyMs`；停探针后不继续显示当前成功值，重启并重试后恢复。 |

线上验证需重新构建并部署网页版本，在同一设备保留探针运行，单独允许线上站点访问本地网络。比较入口 JS 哈希确认部署生效；不能用 CLI 成功或镜像构建成功代替浏览器验收。

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
