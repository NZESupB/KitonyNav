package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type category struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Links       []link `json:"links"`
	Visible     bool   `json:"visible"`
}

type link struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Icon        string `json:"icon"`
	CategoryID  int    `json:"categoryId"`
	Featured    bool   `json:"featured"`
	Visible     bool   `json:"visible"`
}

type serviceStatus struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	LatencyMS *int   `json:"latencyMs,omitempty"`
	UpdatedAt string `json:"updatedAt"`
}

type updateItem struct {
	ID     int    `json:"id"`
	Source string `json:"source"`
	Title  string `json:"title"`
	Time   string `json:"time"`
	URL    string `json:"url"`
}

type bootstrapResponse struct {
	Brand struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"brand"`
	Settings struct {
		DefaultEngine   string `json:"defaultEngine"`
		WeatherLocation string `json:"weatherLocation"`
		Timezone        string `json:"timezone"`
	} `json:"settings"`
	Categories []category      `json:"categories"`
	Services   []serviceStatus `json:"services"`
	Updates    []updateItem    `json:"updates"`
}

type categoryPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type linkPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Icon        string `json:"icon"`
	CategoryID  int    `json:"categoryId"`
	Featured    bool   `json:"featured"`
	Visible     bool   `json:"visible"`
}

type settingsPayload struct {
	BrandName        string `json:"brandName"`
	BrandDescription string `json:"brandDescription"`
	DefaultEngine    string `json:"defaultEngine"`
	WeatherLocation  string `json:"weatherLocation"`
	Timezone         string `json:"timezone"`
}

type store struct{ db *sql.DB }

func openStore(path string) (*store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", filepath.ToSlash(path))
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	if err := seed(db); err != nil {
		db.Close()
		return nil, err
	}
	return &store{db: db}, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
CREATE TABLE IF NOT EXISTS categories (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	icon TEXT NOT NULL DEFAULT 'folder',
	sort_order INTEGER NOT NULL DEFAULT 0,
	visible INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS links (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	url TEXT NOT NULL,
	icon TEXT NOT NULL DEFAULT 'globe',
	featured INTEGER NOT NULL DEFAULT 0,
	visible INTEGER NOT NULL DEFAULT 1,
	sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_category ON links(category_id, sort_order);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS services (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'unknown',
	latency_ms INTEGER,
	updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS updates (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	source TEXT NOT NULL,
	title TEXT NOT NULL,
	time_text TEXT NOT NULL,
	url TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0
);
`)
	return err
}

func seed(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	categories := []struct{ name, description, icon string }{
		{"常用", "高频访问的网站与服务", "star"},
		{"开发", "开发者常用网站与资源", "code"},
		{"工具", "提升效率的在线工具", "wrench"},
		{"资讯", "科技资讯与内容平台", "newspaper"},
		{"云服务", "云平台与基础服务", "cloud"},
		{"生活", "生活方式与实用服务", "coffee"},
	}
	ids := make([]int64, 0, len(categories))
	for i, item := range categories {
		result, insertErr := tx.Exec("INSERT INTO categories(name, description, icon, sort_order) VALUES (?, ?, ?, ?)", item.name, item.description, item.icon, i)
		if insertErr != nil {
			return insertErr
		}
		id, insertErr := result.LastInsertId()
		if insertErr != nil {
			return insertErr
		}
		ids = append(ids, id)
	}
	links := []struct {
		category                     int
		name, description, url, icon string
		featured                     bool
	}{
		{0, "百度", "搜索引擎", "https://www.baidu.com", "baidu", true},
		{0, "哔哩哔哩", "视频弹幕网站", "https://www.bilibili.com", "bilibili", true},
		{0, "微博", "随时随地发现新鲜事", "https://weibo.com", "globe", true},
		{0, "知乎", "有问题，就会有答案", "https://www.zhihu.com", "book-open", true},
		{0, "少数派", "高效工作，品质生活", "https://sspai.com", "sspai", true},
		{0, "GitHub", "代码与开源项目", "https://github.com", "github", true},
		{0, "YouTube", "视频分享与观看", "https://www.youtube.com", "youtube", true},
		{0, "Notion", "知识管理与协作", "https://www.notion.so", "notion", true},
		{1, "GitHub", "全球领先的代码托管平台", "https://github.com", "github", false},
		{1, "Gitee", "代码托管与研发协作", "https://gitee.com", "gitee", false},
		{1, "Vercel", "前端部署与托管平台", "https://vercel.com", "vercel", false},
		{1, "Docker Hub", "容器镜像服务", "https://hub.docker.com", "docker", false},
		{1, "MDN Web Docs", "Web 开发参考文档", "https://developer.mozilla.org", "mdn", false},
		{1, "Stack Overflow", "开发者问答社区", "https://stackoverflow.com", "stack", false},
		{1, "Postman", "API 开发与测试工具", "https://www.postman.com", "postman", false},
		{1, "JetBrains", "开发者工具套件", "https://www.jetbrains.com", "jetbrains", false},
		{2, "ChatGPT", "AI 智能助手", "https://chatgpt.com", "openai", false},
		{2, "在线翻译", "多语言翻译", "https://translate.google.com", "languages", false},
		{2, "Iconfont", "阿里图标库", "https://www.iconfont.cn", "palette", false},
		{2, "JSON 格式化", "在线格式化工具", "https://jsonformatter.org", "braces", false},
		{2, "时间戳转换", "时间工具", "https://www.unixtimestamp.com", "clock", false},
		{2, "二维码生成", "在线生成工具", "https://www.qr-code-generator.com", "qr", false},
		{2, "图片压缩", "在线压缩工具", "https://tinypng.com", "image", false},
		{3, "少数派", "高效工作与生活方式", "https://sspai.com", "sspai", false},
		{3, "36氪", "科技创投资讯", "https://36kr.com", "kr", false},
		{3, "虎嗅", "科技与商业观点", "https://www.huxiu.com", "tiger", false},
		{3, "InfoQ", "技术资讯与实践", "https://www.infoq.cn", "infoq", false},
		{4, "阿里云", "云计算与基础服务", "https://www.aliyun.com", "aliyun", false},
		{4, "腾讯云", "云计算服务", "https://cloud.tencent.com", "cloud", false},
		{4, "Cloudflare", "网络与安全服务", "https://www.cloudflare.com", "cloudflare", false},
		{4, "Netlify", "前端部署平台", "https://www.netlify.com", "netlify", false},
		{5, "豆瓣", "发现生活与文化", "https://www.douban.com", "book-open", false},
		{5, "微信读书", "沉浸式阅读", "https://weread.qq.com", "book-open", false},
		{5, "网易云音乐", "发现好音乐", "https://music.163.com", "music", false},
	}
	orders := make(map[int]int)
	for _, item := range links {
		orders[item.category]++
		if _, err := tx.Exec("INSERT INTO links(category_id, name, description, url, icon, featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", ids[item.category], item.name, item.description, item.url, item.icon, boolInt(item.featured), orders[item.category]); err != nil {
			return err
		}
	}
	settings := map[string]string{"brand_name": "KitonyNav", "brand_description": "把常用的站点，放在顺手的位置。", "default_engine": "Google", "weather_location": "上海市", "timezone": "Asia/Shanghai"}
	for key, value := range settings {
		if _, err := tx.Exec("INSERT INTO settings(key, value) VALUES (?, ?)", key, value); err != nil {
			return err
		}
	}
	services := []struct {
		name, status string
		latency      any
	}{
		{"网站访问", "online", 28}, {"API 服务", "online", 36}, {"数据库", "online", 18}, {"存储服务", "online", 31}, {"邮件服务", "degraded", nil},
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, service := range services {
		if _, err := tx.Exec("INSERT INTO services(name, status, latency_ms, updated_at) VALUES (?, ?, ?, ?)", service.name, service.status, service.latency, now); err != nil {
			return err
		}
	}
	updates := []struct{ source, title, timeText, url string }{
		{"RSS", "少数派：如何构建一个更顺手的工作台", "2 小时前", "https://sspai.com"},
		{"YouTube", "前端性能优化的 10 个实用技巧", "5 小时前", "https://www.youtube.com"},
		{"GitHub", "KitonyNav：导航分类筛选与搜索体验优化", "昨天", "https://github.com"},
		{"RSS", "InfoQ 精选：云原生应用的可观测性实践", "昨天", "https://www.infoq.cn"},
		{"GitHub", "React 19.1 正式发布", "2 天前", "https://github.com/facebook/react/releases"},
	}
	for i, item := range updates {
		if _, err := tx.Exec("INSERT INTO updates(source, title, time_text, url, sort_order) VALUES (?, ?, ?, ?, ?)", item.source, item.title, item.timeText, item.url, i); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func (s *store) bootstrap() (bootstrapResponse, error) {
	var result bootstrapResponse
	settings := map[string]string{}
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return result, err
	}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			rows.Close()
			return result, err
		}
		settings[key] = value
	}
	rows.Close()
	result.Brand.Name = settings["brand_name"]
	result.Brand.Description = settings["brand_description"]
	result.Settings.DefaultEngine = settings["default_engine"]
	result.Settings.WeatherLocation = settings["weather_location"]
	result.Settings.Timezone = settings["timezone"]

	categoryRows, err := s.db.Query("SELECT id, name, description, icon, visible FROM categories WHERE visible = 1 ORDER BY sort_order, id")
	if err != nil {
		return result, err
	}
	var categoryItems []category
	for categoryRows.Next() {
		var item category
		var visible int
		if err := categoryRows.Scan(&item.ID, &item.Name, &item.Description, &item.Icon, &visible); err != nil {
			categoryRows.Close()
			return result, err
		}
		item.Visible = visible == 1
		categoryItems = append(categoryItems, item)
	}
	if err := categoryRows.Err(); err != nil {
		categoryRows.Close()
		return result, err
	}
	categoryRows.Close()
	for i := range categoryItems {
		categoryItems[i].Links, err = s.linksForCategory(categoryItems[i].ID)
		if err != nil {
			return result, err
		}
		result.Categories = append(result.Categories, categoryItems[i])
	}

	serviceRows, err := s.db.Query("SELECT id, name, status, latency_ms, updated_at FROM services ORDER BY id")
	if err != nil {
		return result, err
	}
	for serviceRows.Next() {
		var item serviceStatus
		var latency sql.NullInt64
		if err := serviceRows.Scan(&item.ID, &item.Name, &item.Status, &latency, &item.UpdatedAt); err != nil {
			serviceRows.Close()
			return result, err
		}
		if latency.Valid {
			value := int(latency.Int64)
			item.LatencyMS = &value
		}
		result.Services = append(result.Services, item)
	}
	serviceRows.Close()

	updateRows, err := s.db.Query("SELECT id, source, title, time_text, url FROM updates ORDER BY sort_order, id")
	if err != nil {
		return result, err
	}
	for updateRows.Next() {
		var item updateItem
		if err := updateRows.Scan(&item.ID, &item.Source, &item.Title, &item.Time, &item.URL); err != nil {
			updateRows.Close()
			return result, err
		}
		result.Updates = append(result.Updates, item)
	}
	updateRows.Close()
	return result, nil
}

func (s *store) linksForCategory(categoryID int) ([]link, error) {
	rows, err := s.db.Query("SELECT id, name, description, url, icon, category_id, featured, visible FROM links WHERE category_id = ? AND visible = 1 ORDER BY sort_order, id", categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]link, 0)
	for rows.Next() {
		var item link
		var featured, visible int
		if err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.URL, &item.Icon, &item.CategoryID, &featured, &visible); err != nil {
			return nil, err
		}
		item.Featured = featured == 1
		item.Visible = visible == 1
		result = append(result, item)
	}
	return result, nil
}

func (s *store) insertCategory(payload categoryPayload) (category, error) {
	result, err := s.db.Exec("INSERT INTO categories(name, description, icon, sort_order) SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM categories", payload.Name, payload.Description, defaultString(payload.Icon, "folder"))
	if err != nil {
		return category{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return category{}, err
	}
	return category{ID: int(id), Name: payload.Name, Description: payload.Description, Icon: defaultString(payload.Icon, "folder"), Visible: true, Links: []link{}}, nil
}

func (s *store) updateCategory(id int, payload categoryPayload) (category, error) {
	if _, err := s.db.Exec("UPDATE categories SET name = ?, description = ?, icon = ? WHERE id = ?", payload.Name, payload.Description, defaultString(payload.Icon, "folder"), id); err != nil {
		return category{}, err
	}
	return s.categoryByID(id)
}

func (s *store) categoryByID(id int) (category, error) {
	var item category
	var visible int
	if err := s.db.QueryRow("SELECT id, name, description, icon, visible FROM categories WHERE id = ?", id).Scan(&item.ID, &item.Name, &item.Description, &item.Icon, &visible); err != nil {
		return item, err
	}
	item.Visible = visible == 1
	var err error
	item.Links, err = s.linksForCategory(item.ID)
	return item, err
}

func (s *store) insertLink(payload linkPayload) (link, error) {
	if _, err := s.db.Exec("INSERT INTO links(category_id, name, description, url, icon, featured, visible, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM links WHERE category_id = ?), 0) + 1)", payload.CategoryID, payload.Name, payload.Description, payload.URL, defaultString(payload.Icon, "globe"), boolInt(payload.Featured), boolInt(payload.Visible), payload.CategoryID); err != nil {
		return link{}, err
	}
	var result link
	var featured, visible int
	if err := s.db.QueryRow("SELECT id, name, description, url, icon, category_id, featured, visible FROM links WHERE id = last_insert_rowid()").Scan(&result.ID, &result.Name, &result.Description, &result.URL, &result.Icon, &result.CategoryID, &featured, &visible); err != nil {
		return result, err
	}
	result.Featured = featured == 1
	result.Visible = visible == 1
	return result, nil
}

func (s *store) updateLink(id int, payload linkPayload) (link, error) {
	if _, err := s.db.Exec("UPDATE links SET category_id = ?, name = ?, description = ?, url = ?, icon = ?, featured = ?, visible = ? WHERE id = ?", payload.CategoryID, payload.Name, payload.Description, payload.URL, defaultString(payload.Icon, "globe"), boolInt(payload.Featured), boolInt(payload.Visible), id); err != nil {
		return link{}, err
	}
	var result link
	var featured, visible int
	if err := s.db.QueryRow("SELECT id, name, description, url, icon, category_id, featured, visible FROM links WHERE id = ?", id).Scan(&result.ID, &result.Name, &result.Description, &result.URL, &result.Icon, &result.CategoryID, &featured, &visible); err != nil {
		return result, err
	}
	result.Featured = featured == 1
	result.Visible = visible == 1
	return result, nil
}

func (s *store) updateSettings(payload settingsPayload) error {
	values := map[string]string{
		"brand_name":        defaultString(payload.BrandName, "KitonyNav"),
		"brand_description": defaultString(payload.BrandDescription, "把常用的站点，放在顺手的位置。"),
		"default_engine":    defaultString(payload.DefaultEngine, "Google"),
		"weather_location":  defaultString(payload.WeatherLocation, "上海市"),
		"timezone":          defaultString(payload.Timezone, "Asia/Shanghai"),
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for key, value := range values {
		if _, err := tx.Exec("INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

type authManager struct {
	mu       sync.Mutex
	password string
	secure   bool
	sessions map[string]time.Time
	csrf     map[string]string
	attempts map[string][]time.Time
}

func newAuthManager(password string, secure bool) *authManager {
	return &authManager{password: password, secure: secure, sessions: map[string]time.Time{}, csrf: map[string]string{}, attempts: map[string][]time.Time{}}
}

func (a *authManager) authenticate(w http.ResponseWriter, r *http.Request, password string) (string, error) {
	address := clientIP(r)
	a.mu.Lock()
	now := time.Now()
	validAfter := now.Add(-time.Minute)
	var recent []time.Time
	for _, attempt := range a.attempts[address] {
		if attempt.After(validAfter) {
			recent = append(recent, attempt)
		}
	}
	if len(recent) >= 5 {
		a.mu.Unlock()
		return "", errors.New("登录尝试过于频繁，请稍后再试")
	}
	if password != a.password {
		a.attempts[address] = append(recent, now)
		a.mu.Unlock()
		return "", errors.New("密码不正确")
	}
	token := randomToken(32)
	csrf := randomToken(18)
	a.sessions[token] = now.Add(12 * time.Hour)
	a.csrf[token] = csrf
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: "kitonynav_session", Value: token, Path: "/", HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteLaxMode, MaxAge: 12 * 60 * 60})
	http.SetCookie(w, &http.Cookie{Name: "kitonynav_csrf", Value: csrf, Path: "/", HttpOnly: false, Secure: a.secure, SameSite: http.SameSiteLaxMode, MaxAge: 12 * 60 * 60})
	return csrf, nil
}

func (a *authManager) authorized(r *http.Request) bool {
	cookie, err := r.Cookie("kitonynav_session")
	if err != nil || cookie.Value == "" {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	expires, exists := a.sessions[cookie.Value]
	if !exists || expires.Before(time.Now()) {
		delete(a.sessions, cookie.Value)
		return false
	}
	return true
}

func (a *authManager) csrfValid(r *http.Request) bool {
	session, err := r.Cookie("kitonynav_session")
	if err != nil || session.Value == "" {
		return false
	}
	header := r.Header.Get("X-CSRF-Token")
	if header == "" {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if expected := a.csrf[session.Value]; expected != "" {
		return expected == header
	}
	cookie, err := r.Cookie("kitonynav_csrf")
	return err == nil && cookie.Value != "" && cookie.Value == header
}

func randomToken(bytesCount int) string {
	buffer := make([]byte, bytesCount)
	if _, err := rand.Read(buffer); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(buffer)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

type appServer struct {
	store *store
	auth  *authManager
}

func (s *appServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/bootstrap", s.handleBootstrap)
	mux.HandleFunc("GET /api/v1/widgets/{id}/data", s.handleWidgetData)
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)
	mux.HandleFunc("GET /api/v1/auth/session", s.handleSession)
	mux.HandleFunc("POST /api/v1/auth/logout", s.handleLogout)
	mux.HandleFunc("POST /api/v1/admin/categories", s.requireWrite(s.handleCreateCategory))
	mux.HandleFunc("PUT /api/v1/admin/categories/{id}", s.requireWrite(s.handleUpdateCategory))
	mux.HandleFunc("DELETE /api/v1/admin/categories/{id}", s.requireWrite(s.handleDeleteCategory))
	mux.HandleFunc("POST /api/v1/admin/links", s.requireWrite(s.handleCreateLink))
	mux.HandleFunc("PUT /api/v1/admin/links/{id}", s.requireWrite(s.handleUpdateLink))
	mux.HandleFunc("DELETE /api/v1/admin/links/{id}", s.requireWrite(s.handleDeleteLink))
	mux.HandleFunc("PUT /api/v1/admin/settings", s.requireWrite(s.handleUpdateSettings))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return loggingMiddleware(mux)
}

func (s *appServer) handleBootstrap(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.bootstrap()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取导航数据失败")
		return
	}
	payload, err := json.Marshal(data)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "序列化导航数据失败")
		return
	}
	digest := sha256.Sum256(payload)
	etag := fmt.Sprintf("\"%x\"", digest[:8])
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "public, max-age=15, stale-while-revalidate=60")
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(payload)
}

func (s *appServer) handleWidgetData(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"id": r.PathValue("id"), "status": "cached", "updatedAt": time.Now().UTC().Format(time.RFC3339), "message": "外部数据由后台任务异步刷新"})
}

func (s *appServer) handleLogin(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "请求格式不正确")
		return
	}
	csrfToken, err := s.auth.authenticate(w, r, payload.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "csrfToken": csrfToken})
}

func (s *appServer) handleSession(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": s.auth.authorized(r)})
}

func (s *appServer) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("kitonynav_session"); err == nil {
		s.auth.mu.Lock()
		delete(s.auth.sessions, cookie.Value)
		delete(s.auth.csrf, cookie.Value)
		s.auth.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: "kitonynav_session", Value: "", Path: "/", HttpOnly: true, Secure: s.auth.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: "kitonynav_csrf", Value: "", Path: "/", Secure: s.auth.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	w.WriteHeader(http.StatusNoContent)
}

func (s *appServer) requireWrite(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.auth.authorized(r) {
			writeError(w, http.StatusUnauthorized, "请先登录后台")
			return
		}
		if r.Method != http.MethodGet && !s.auth.csrfValid(r) {
			writeError(w, http.StatusForbidden, "CSRF 校验失败")
			return
		}
		next(w, r)
	}
}

func (s *appServer) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	var payload categoryPayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
		writeError(w, http.StatusBadRequest, "分类名称不能为空")
		return
	}
	item, err := s.store.insertCategory(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存分类失败")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *appServer) handleUpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "分类 ID 不正确")
		return
	}
	var payload categoryPayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
		writeError(w, http.StatusBadRequest, "分类名称不能为空")
		return
	}
	item, err := s.store.updateCategory(id, payload)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "分类不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存分类失败")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *appServer) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "分类 ID 不正确")
		return
	}
	if _, err := s.store.db.Exec("DELETE FROM categories WHERE id = ?", id); err != nil {
		writeError(w, http.StatusInternalServerError, "删除分类失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *appServer) handleCreateLink(w http.ResponseWriter, r *http.Request) {
	var payload linkPayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validHTTPURL(payload.URL) || payload.CategoryID <= 0 {
		writeError(w, http.StatusBadRequest, "链接名称、地址或分类不正确")
		return
	}
	item, err := s.store.insertLink(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存链接失败")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *appServer) handleUpdateLink(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "链接 ID 不正确")
		return
	}
	var payload linkPayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validHTTPURL(payload.URL) || payload.CategoryID <= 0 {
		writeError(w, http.StatusBadRequest, "链接名称、地址或分类不正确")
		return
	}
	item, err := s.store.updateLink(id, payload)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "链接不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存链接失败")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *appServer) handleDeleteLink(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "链接 ID 不正确")
		return
	}
	if _, err := s.store.db.Exec("DELETE FROM links WHERE id = ?", id); err != nil {
		writeError(w, http.StatusInternalServerError, "删除链接失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *appServer) handleUpdateSettings(w http.ResponseWriter, r *http.Request) {
	var payload settingsPayload
	if err := decodeJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "站点设置格式不正确")
		return
	}
	if err := s.store.updateSettings(payload); err != nil {
		writeError(w, http.StatusInternalServerError, "保存站点设置失败")
		return
	}
	data, err := s.store.bootstrap()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取更新后的设置失败")
		return
	}
	writeJSON(w, http.StatusOK, data)
}

func pathID(r *http.Request, key string) (int, error) { return strconv.Atoi(r.PathValue(key)) }

func validHTTPURL(value string) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(value))
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func getenv(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func main() {
	dataDir := getenv("DATA_DIR", "./data")
	databasePath := filepath.Join(dataDir, "kitonynav.db")
	data, err := openStore(databasePath)
	if err != nil {
		log.Fatal(err)
	}
	defer data.db.Close()
	secure := strings.EqualFold(getenv("COOKIE_SECURE", "false"), "true")
	server := &appServer{store: data, auth: newAuthManager(getenv("ADMIN_PASSWORD", "kitony-dev"), secure)}
	port := getenv("PORT", "8080")
	go refreshLoop(context.Background(), data)
	log.Printf("KitonyNav API listening on :%s", port)
	handler := server.routes()
	if staticDir := strings.TrimSpace(os.Getenv("STATIC_DIR")); staticDir != "" {
		handler = staticMiddleware(handler, staticDir)
	}
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal(err)
	}
}

func staticMiddleware(api http.Handler, directory string) http.Handler {
	files := http.FileServer(http.Dir(directory))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/healthz" {
			api.ServeHTTP(w, r)
			return
		}
		requested := filepath.Join(directory, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(requested); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		fallback := r.Clone(r.Context())
		fallback.URL.Path = "/"
		files.ServeHTTP(w, fallback)
	})
}

func refreshLoop(ctx context.Context, data *store) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = data.db.Exec("INSERT INTO settings(key, value) VALUES ('last_refresh_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", time.Now().UTC().Format(time.RFC3339))
		}
	}
}
