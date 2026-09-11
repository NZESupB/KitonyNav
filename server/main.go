package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
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
	_ "time/tzdata" // 内置 IANA 时区库，容器内没有安装 tzdata 时也能校验时区

	_ "modernc.org/sqlite"
)

type category struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	IconKind    string `json:"iconKind,omitempty"`
	IconURL     string `json:"iconUrl,omitempty"`
	Links       []link `json:"links"`
	Visible     bool   `json:"visible"`
}

type link struct {
	ID                  int    `json:"id"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	URL                 string `json:"url"`
	Icon                string `json:"icon"`
	IconKind            string `json:"iconKind,omitempty"`
	IconURL             string `json:"iconUrl,omitempty"`
	CategoryID          int    `json:"categoryId"`
	Featured            bool   `json:"featured"`
	Visible             bool   `json:"visible"`
	ConnectivityEnabled bool   `json:"connectivityEnabled"`
}

type serviceStatus struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Status          string `json:"status"`
	LatencyMS       *int   `json:"latencyMs,omitempty"`
	UpdatedAt       string `json:"updatedAt"`
	Enabled         bool   `json:"enabled"`
	CheckType       string `json:"checkType"`
	Target          string `json:"target,omitempty"`
	Port            *int   `json:"port,omitempty"`
	SourceStatus    string `json:"sourceStatus,omitempty"`
	SourceUpdatedAt string `json:"sourceUpdatedAt,omitempty"`
	SourceError     string `json:"sourceError,omitempty"`
}

type updateItem struct {
	ID             int    `json:"id"`
	Source         string `json:"source"`
	Title          string `json:"title"`
	Time           string `json:"time"`
	URL            string `json:"url"`
	SubscriptionID *int   `json:"subscriptionId,omitempty"`
	PublishedAt    string `json:"publishedAt,omitempty"`
}

type subscription struct {
	ID              int    `json:"id"`
	Type            string `json:"type"`
	Name            string `json:"name"`
	URL             string `json:"url"`
	Enabled         bool   `json:"enabled"`
	IntervalSeconds int    `json:"intervalSeconds"`
	LastCheckedAt   string `json:"lastCheckedAt,omitempty"`
	LastError       string `json:"lastError,omitempty"`
	ItemCount       int    `json:"itemCount"`
}

type networkInfo struct {
	Address string `json:"address,omitempty"`
	Family  string `json:"family,omitempty"`
	Source  string `json:"source,omitempty"`
	Status  string `json:"status"`
}

type bootstrapResponse struct {
	Brand struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"brand"`
	Settings struct {
		DefaultEngine   string             `json:"defaultEngine"`
		WeatherLocation string             `json:"weatherLocation"`
		Timezone        string             `json:"timezone"`
		Appearance      appearanceSettings `json:"appearance"`
	} `json:"settings"`
	Categories    []category      `json:"categories"`
	Services      []serviceStatus `json:"services"`
	Updates       []updateItem    `json:"updates"`
	Subscriptions []subscription  `json:"subscriptions"`
	Network       networkInfo     `json:"network"`
}

type appearanceSettings struct {
	Theme        string `json:"theme"`
	ClockStyle   string `json:"clockStyle"`
	Clock24Hour  bool   `json:"clock24Hour"`
	ClockSeconds bool   `json:"clockSeconds"`
	ClockColor   string `json:"clockColor"`
	ClockSpeed   int    `json:"clockSpeed"`
}

type categoryPayload struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	IconKind    string `json:"iconKind"`
	IconURL     string `json:"iconUrl"`
}

type linkPayload struct {
	Name                string `json:"name"`
	Description         string `json:"description"`
	URL                 string `json:"url"`
	Icon                string `json:"icon"`
	IconKind            string `json:"iconKind"`
	IconURL             string `json:"iconUrl"`
	CategoryID          int    `json:"categoryId"`
	Featured            bool   `json:"featured"`
	Visible             bool   `json:"visible"`
	ConnectivityEnabled bool   `json:"connectivityEnabled"`
}

type settingsPayload struct {
	BrandName        string `json:"brandName"`
	BrandDescription string `json:"brandDescription"`
	DefaultEngine    string `json:"defaultEngine"`
	WeatherLocation  string `json:"weatherLocation"`
	Timezone         string `json:"timezone"`
	Theme            string `json:"theme"`
	ClockStyle       string `json:"clockStyle"`
	Clock24Hour      bool   `json:"clock24Hour"`
	ClockSeconds     bool   `json:"clockSeconds"`
	ClockColor       string `json:"clockColor"`
	ClockSpeed       int    `json:"clockSpeed"`
}

type servicePayload struct {
	Name      string `json:"name"`
	Enabled   bool   `json:"enabled"`
	CheckType string `json:"checkType"`
	Target    string `json:"target"`
	Port      int    `json:"port"`
}

type subscriptionPayload struct {
	Type            string `json:"type"`
	Name            string `json:"name"`
	URL             string `json:"url"`
	Enabled         bool   `json:"enabled"`
	IntervalSeconds int    `json:"intervalSeconds"`
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
	if err := applyDataDefaults(db); err != nil {
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
CREATE TABLE IF NOT EXISTS subscriptions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	type TEXT NOT NULL,
	name TEXT NOT NULL,
	url TEXT NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 1,
	interval_seconds INTEGER NOT NULL DEFAULT 900,
	last_checked_at TEXT,
	last_error TEXT NOT NULL DEFAULT '',
	etag TEXT NOT NULL DEFAULT '',
	last_modified TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS feed_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
	external_id TEXT NOT NULL,
	title TEXT NOT NULL,
	url TEXT NOT NULL,
	published_at TEXT,
	fetched_at TEXT NOT NULL,
	UNIQUE(subscription_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_items_published ON feed_items(published_at DESC, id DESC);
`)
	if err != nil {
		return err
	}
	columns := map[string]string{
		"categories": "icon_kind TEXT NOT NULL DEFAULT 'builtin', icon_url TEXT NOT NULL DEFAULT ''",
		"links":      "icon_kind TEXT NOT NULL DEFAULT 'builtin', icon_url TEXT NOT NULL DEFAULT '', connectivity_enabled INTEGER NOT NULL DEFAULT 1",
		"services":   "enabled INTEGER NOT NULL DEFAULT 1, check_type TEXT NOT NULL DEFAULT 'none', target TEXT NOT NULL DEFAULT '', port INTEGER, source_status TEXT NOT NULL DEFAULT 'unknown', source_updated_at TEXT NOT NULL DEFAULT '', source_error TEXT NOT NULL DEFAULT ''",
	}
	for table, definition := range columns {
		for _, column := range strings.Split(definition, ", ") {
			name := strings.Fields(column)[0]
			if err := ensureColumn(db, table, name, column); err != nil {
				return err
			}
		}
	}
	return nil
}

func ensureColumn(db *sql.DB, table, name, definition string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return err
	}
	defer rows.Close()
	var found bool
	for rows.Next() {
		var cid int
		var column, columnType string
		var notNull, pk int
		var defaultValue any
		if err := rows.Scan(&cid, &column, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		if column == name {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if found {
		return nil
	}
	_, err = db.Exec("ALTER TABLE " + table + " ADD COLUMN " + definition)
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
	// 服务与动态不再预置演示数据：服务由管理端配置后真实检查，动态由订阅抓取产生。
	return tx.Commit()
}

const defaultSubscriptionSource = "NZESupB/KitonyNav"

// applyDataDefaults 对每个数据库只执行一次：清掉旧版本写入的演示动态，补上本项目的 GitHub 订阅。
// 用 settings 标记而不是判断"订阅是否为空"，避免把用户自己删掉的订阅又加回来。
func applyDataDefaults(db *sql.DB) error {
	var applied string
	if err := db.QueryRow("SELECT value FROM settings WHERE key = 'data_defaults_v1'").Scan(&applied); err == nil {
		return nil
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// updates 是 v0.0.1 的演示表，没有任何写入入口，整表清空即可。
	if _, err := tx.Exec("DELETE FROM updates"); err != nil {
		return err
	}
	var existing int
	if err := tx.QueryRow("SELECT COUNT(*) FROM subscriptions WHERE type = 'github' AND url = ?", defaultSubscriptionSource).Scan(&existing); err != nil {
		return err
	}
	if existing == 0 {
		if _, err := tx.Exec("INSERT INTO subscriptions(type, name, url, enabled, interval_seconds) VALUES ('github', ?, ?, 1, 900)", "KitonyNav", defaultSubscriptionSource); err != nil {
			return err
		}
	}
	if _, err := tx.Exec("INSERT INTO settings(key, value) VALUES ('data_defaults_v1', 'applied')"); err != nil {
		return err
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
	// 列表字段始终以数组返回，配置被删空时不能序列化成 null。
	result := bootstrapResponse{Categories: []category{}, Services: []serviceStatus{}, Updates: []updateItem{}}
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
	result.Settings.Appearance = appearanceSettings{
		Theme:        defaultString(settings["theme_default"], "system"),
		ClockStyle:   defaultString(settings["clock_style"], "plain"),
		Clock24Hour:  settings["clock_24_hour"] != "false",
		ClockSeconds: settings["clock_seconds"] == "true",
		ClockColor:   defaultString(settings["clock_color"], "#2f6ff3"),
		ClockSpeed:   defaultInt(parseInt(settings["clock_speed"]), 1),
	}

	categoryRows, err := s.db.Query("SELECT id, name, description, icon, icon_kind, icon_url, visible FROM categories WHERE visible = 1 ORDER BY sort_order, id")
	if err != nil {
		return result, err
	}
	var categoryItems []category
	for categoryRows.Next() {
		var item category
		var visible int
		if err := categoryRows.Scan(&item.ID, &item.Name, &item.Description, &item.Icon, &item.IconKind, &item.IconURL, &visible); err != nil {
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

	serviceRows, err := s.db.Query("SELECT id, name, status, latency_ms, updated_at, enabled, check_type, target, port, source_status, source_updated_at, source_error FROM services ORDER BY id")
	if err != nil {
		return result, err
	}
	for serviceRows.Next() {
		var item serviceStatus
		var latency sql.NullInt64
		var port sql.NullInt64
		var enabled int
		if err := serviceRows.Scan(&item.ID, &item.Name, &item.Status, &latency, &item.UpdatedAt, &enabled, &item.CheckType, &item.Target, &port, &item.SourceStatus, &item.SourceUpdatedAt, &item.SourceError); err != nil {
			serviceRows.Close()
			return result, err
		}
		item.Enabled = enabled == 1
		if port.Valid {
			value := int(port.Int64)
			item.Port = &value
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
	feedRows, feedErr := s.db.Query("SELECT f.id, s.type, f.title, f.url, s.id, COALESCE(f.published_at, '') FROM feed_items f JOIN subscriptions s ON s.id = f.subscription_id WHERE s.enabled = 1 ORDER BY COALESCE(f.published_at, f.fetched_at) DESC, f.id DESC LIMIT 50")
	if feedErr != nil {
		return result, feedErr
	}
	for feedRows.Next() {
		var item updateItem
		var sourceType string
		var subscriptionID int
		if err := feedRows.Scan(&item.ID, &sourceType, &item.Title, &item.URL, &subscriptionID, &item.PublishedAt); err != nil {
			feedRows.Close()
			return result, err
		}
		item.SubscriptionID = &subscriptionID
		item.Source = strings.ToUpper(sourceType)
		if item.Source == "GITHUB" {
			item.Source = "GitHub"
		}
		if item.Source == "YOUTUBE" {
			item.Source = "YouTube"
		}
		if item.Source == "RSS" {
			item.Source = "RSS"
		}
		item.Time = defaultString(item.PublishedAt, "刚刚")
		result.Updates = append(result.Updates, item)
	}
	feedRows.Close()
	result.Subscriptions, err = s.subscriptions()
	if err != nil {
		return result, err
	}
	result.Network = networkInfo{Status: "unavailable"}
	return result, nil
}

func defaultInt(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}

func parseInt(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return parsed
}

func (s *store) subscriptions() ([]subscription, error) {
	rows, err := s.db.Query("SELECT id, type, name, url, enabled, interval_seconds, COALESCE(last_checked_at, ''), COALESCE(last_error, ''), (SELECT COUNT(*) FROM feed_items f WHERE f.subscription_id = subscriptions.id) FROM subscriptions ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]subscription, 0)
	for rows.Next() {
		var item subscription
		var enabled int
		if err := rows.Scan(&item.ID, &item.Type, &item.Name, &item.URL, &enabled, &item.IntervalSeconds, &item.LastCheckedAt, &item.LastError, &item.ItemCount); err != nil {
			return nil, err
		}
		item.Enabled = enabled == 1
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *store) insertSubscription(payload subscriptionPayload) (subscription, error) {
	interval := defaultInt(payload.IntervalSeconds, 900)
	result, err := s.db.Exec("INSERT INTO subscriptions(type, name, url, enabled, interval_seconds) VALUES (?, ?, ?, ?, ?)", payload.Type, defaultString(payload.Name, payload.URL), payload.URL, boolInt(payload.Enabled), interval)
	if err != nil {
		return subscription{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return subscription{}, err
	}
	return s.subscriptionByID(int(id))
}

func (s *store) subscriptionByID(id int) (subscription, error) {
	var item subscription
	var enabled int
	if err := s.db.QueryRow("SELECT id, type, name, url, enabled, interval_seconds, COALESCE(last_checked_at, ''), COALESCE(last_error, ''), (SELECT COUNT(*) FROM feed_items f WHERE f.subscription_id = subscriptions.id) FROM subscriptions WHERE id = ?", id).Scan(&item.ID, &item.Type, &item.Name, &item.URL, &enabled, &item.IntervalSeconds, &item.LastCheckedAt, &item.LastError, &item.ItemCount); err != nil {
		return item, err
	}
	item.Enabled = enabled == 1
	return item, nil
}

func (s *store) updateSubscription(id int, payload subscriptionPayload) (subscription, error) {
	interval := defaultInt(payload.IntervalSeconds, 900)
	if _, err := s.db.Exec("UPDATE subscriptions SET type = ?, name = ?, url = ?, enabled = ?, interval_seconds = ? WHERE id = ?", payload.Type, defaultString(payload.Name, payload.URL), payload.URL, boolInt(payload.Enabled), interval, id); err != nil {
		return subscription{}, err
	}
	return s.subscriptionByID(id)
}

func mustSubscriptions(s *store) []subscription { items, _ := s.subscriptions(); return items }

type rssFeed struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
	Entries []atomItem `xml:"entry"`
}
type rssItem struct {
	GUID        string `xml:"guid"`
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
}
type atomItem struct {
	ID    string `xml:"id"`
	Title string `xml:"title"`
	Link  struct {
		Href string `xml:"href,attr"`
	} `xml:"link"`
	Updated   string `xml:"updated"`
	Published string `xml:"published"`
}

type githubRelease struct {
	ID          int64  `json:"id"`
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	HTMLURL     string `json:"html_url"`
	PublishedAt string `json:"published_at"`
}

func (s *store) refreshSubscription(id int) error {
	var item subscription
	var enabled int
	if err := s.db.QueryRow("SELECT id, type, name, url, enabled, interval_seconds FROM subscriptions WHERE id = ?", id).Scan(&item.ID, &item.Type, &item.Name, &item.URL, &enabled, &item.IntervalSeconds); err != nil {
		return err
	}
	if enabled == 0 {
		return errors.New("订阅已停用")
	}
	target := item.URL
	tagsFeed := ""
	if item.Type == "github" {
		owner, repo, ok := githubRepoParts(item.URL)
		if !ok {
			return s.markSubscriptionError(id, "GitHub 源需要 owner/repo")
		}
		target = "https://api.github.com/repos/" + owner + "/" + repo + "/releases?per_page=20"
		tagsFeed = "https://github.com/" + owner + "/" + repo + "/tags.atom"
	}
	body, err := fetchSubscriptionPayload(target)
	if err != nil {
		return s.markSubscriptionError(id, err.Error())
	}
	var feedItems []feedEntry
	if item.Type == "github" {
		if feedItems, err = parseGitHubReleases(body); err != nil {
			return s.markSubscriptionError(id, err.Error())
		}
		if len(feedItems) == 0 {
			// 仓库还没发布 Release 时退回 tags.atom，让"打了标签"也能产生动态。
			if body, err = fetchSubscriptionPayload(tagsFeed); err != nil {
				return s.markSubscriptionError(id, err.Error())
			}
			if feedItems, err = parseFeedDocument(body); err != nil {
				return s.markSubscriptionError(id, err.Error())
			}
		}
	} else if feedItems, err = parseFeedDocument(body); err != nil {
		return s.markSubscriptionError(id, err.Error())
	}
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, feedItem := range feedItems {
		if _, err := tx.Exec("INSERT INTO feed_items(subscription_id, external_id, title, url, published_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(subscription_id, external_id) DO UPDATE SET title = excluded.title, url = excluded.url, published_at = excluded.published_at, fetched_at = excluded.fetched_at", id, feedItem.externalID, feedItem.title, feedItem.url, feedItem.published, now); err != nil {
			return err
		}
	}
	if _, err := tx.Exec("DELETE FROM feed_items WHERE subscription_id = ? AND id NOT IN (SELECT id FROM feed_items WHERE subscription_id = ? ORDER BY COALESCE(published_at, fetched_at) DESC, id DESC LIMIT 200)", id, id); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE subscriptions SET last_checked_at = ?, last_error = '' WHERE id = ?", now, id); err != nil {
		return err
	}
	return tx.Commit()
}

type feedEntry struct {
	externalID string
	title      string
	url        string
	published  string
}

// fetchSubscriptionPayload 是订阅抓取的统一边界：只允许外部 HTTP(S)、限制重定向次数与响应大小。
func fetchSubscriptionPayload(target string) ([]byte, error) {
	if err := safeExternalHTTPURL(target); err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 12 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return errors.New("重定向次数过多")
		}
		if err := safeExternalHTTPURL(req.URL.String()); err != nil {
			return errors.New("重定向地址不安全")
		}
		return nil
	}}
	request, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		return nil, errors.New("订阅地址不正确")
	}
	request.Header.Set("User-Agent", "KitonyNav/0.0.2")
	response, err := client.Do(request)
	if err != nil {
		return nil, errors.New("订阅请求失败：" + err.Error())
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("订阅返回 HTTP %d", response.StatusCode)
	}
	return io.ReadAll(io.LimitReader(response.Body, 2<<20))
}

func githubRepoParts(value string) (string, string, bool) {
	parts := strings.Split(strings.Trim(value, "/"), "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func parseGitHubReleases(body []byte) ([]feedEntry, error) {
	var releases []githubRelease
	if err := json.Unmarshal(body, &releases); err != nil {
		return nil, errors.New("GitHub 响应格式不正确")
	}
	items := make([]feedEntry, 0, len(releases))
	for _, release := range releases {
		items = append(items, feedEntry{externalID: strconv.FormatInt(release.ID, 10), title: defaultString(release.Name, release.TagName), url: release.HTMLURL, published: release.PublishedAt})
	}
	return items, nil
}

// parseFeedDocument 同时处理 RSS 2.0 与 Atom；GitHub 的 tags.atom 也走这条路径。
func parseFeedDocument(body []byte) ([]feedEntry, error) {
	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, errors.New("RSS/Atom 响应格式不正确")
	}
	items := make([]feedEntry, 0, len(feed.Channel.Items)+len(feed.Entries))
	for _, entry := range feed.Channel.Items {
		key := defaultString(entry.GUID, entry.Link)
		if key != "" && entry.Title != "" {
			items = append(items, feedEntry{externalID: key, title: entry.Title, url: entry.Link, published: entry.PubDate})
		}
	}
	for _, entry := range feed.Entries {
		key := defaultString(entry.ID, entry.Link.Href)
		if key != "" && entry.Title != "" {
			items = append(items, feedEntry{externalID: key, title: entry.Title, url: entry.Link.Href, published: defaultString(entry.Published, entry.Updated)})
		}
	}
	return items, nil
}

func (s *store) markSubscriptionError(id int, message string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, _ = s.db.Exec("UPDATE subscriptions SET last_checked_at = ?, last_error = ? WHERE id = ?", now, message, id)
	return fmt.Errorf("%s", message)
}

func (s *store) linksForCategory(categoryID int) ([]link, error) {
	rows, err := s.db.Query("SELECT id, name, description, url, icon, icon_kind, icon_url, category_id, featured, visible, connectivity_enabled FROM links WHERE category_id = ? AND visible = 1 ORDER BY sort_order, id", categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]link, 0)
	for rows.Next() {
		var item link
		var featured, visible, connectivityEnabled int
		if err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.URL, &item.Icon, &item.IconKind, &item.IconURL, &item.CategoryID, &featured, &visible, &connectivityEnabled); err != nil {
			return nil, err
		}
		item.Featured = featured == 1
		item.Visible = visible == 1
		item.ConnectivityEnabled = connectivityEnabled == 1
		result = append(result, item)
	}
	return result, nil
}

func (s *store) insertCategory(payload categoryPayload) (category, error) {
	result, err := s.db.Exec("INSERT INTO categories(name, description, icon, icon_kind, icon_url, sort_order) SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM categories", payload.Name, payload.Description, defaultString(payload.Icon, "folder"), defaultString(payload.IconKind, "builtin"), strings.TrimSpace(payload.IconURL))
	if err != nil {
		return category{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return category{}, err
	}
	return category{ID: int(id), Name: payload.Name, Description: payload.Description, Icon: defaultString(payload.Icon, "folder"), IconKind: defaultString(payload.IconKind, "builtin"), IconURL: strings.TrimSpace(payload.IconURL), Visible: true, Links: []link{}}, nil
}

func (s *store) updateCategory(id int, payload categoryPayload) (category, error) {
	if _, err := s.db.Exec("UPDATE categories SET name = ?, description = ?, icon = ?, icon_kind = ?, icon_url = ? WHERE id = ?", payload.Name, payload.Description, defaultString(payload.Icon, "folder"), defaultString(payload.IconKind, "builtin"), strings.TrimSpace(payload.IconURL), id); err != nil {
		return category{}, err
	}
	return s.categoryByID(id)
}

func (s *store) categoryByID(id int) (category, error) {
	var item category
	var visible int
	if err := s.db.QueryRow("SELECT id, name, description, icon, icon_kind, icon_url, visible FROM categories WHERE id = ?", id).Scan(&item.ID, &item.Name, &item.Description, &item.Icon, &item.IconKind, &item.IconURL, &visible); err != nil {
		return item, err
	}
	item.Visible = visible == 1
	var err error
	item.Links, err = s.linksForCategory(item.ID)
	return item, err
}

func (s *store) insertLink(payload linkPayload) (link, error) {
	if _, err := s.db.Exec("INSERT INTO links(category_id, name, description, url, icon, icon_kind, icon_url, featured, visible, connectivity_enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) FROM links WHERE category_id = ?), 0) + 1)", payload.CategoryID, payload.Name, payload.Description, payload.URL, defaultString(payload.Icon, "globe"), defaultString(payload.IconKind, "builtin"), strings.TrimSpace(payload.IconURL), boolInt(payload.Featured), boolInt(payload.Visible), boolInt(payload.ConnectivityEnabled), payload.CategoryID); err != nil {
		return link{}, err
	}
	var result link
	var featured, visible int
	var connectivityEnabled int
	if err := s.db.QueryRow("SELECT id, name, description, url, icon, icon_kind, icon_url, category_id, featured, visible, connectivity_enabled FROM links WHERE id = last_insert_rowid()").Scan(&result.ID, &result.Name, &result.Description, &result.URL, &result.Icon, &result.IconKind, &result.IconURL, &result.CategoryID, &featured, &visible, &connectivityEnabled); err != nil {
		return result, err
	}
	result.Featured = featured == 1
	result.Visible = visible == 1
	result.ConnectivityEnabled = connectivityEnabled == 1
	return result, nil
}

func (s *store) updateLink(id int, payload linkPayload) (link, error) {
	if _, err := s.db.Exec("UPDATE links SET category_id = ?, name = ?, description = ?, url = ?, icon = ?, icon_kind = ?, icon_url = ?, featured = ?, visible = ?, connectivity_enabled = ? WHERE id = ?", payload.CategoryID, payload.Name, payload.Description, payload.URL, defaultString(payload.Icon, "globe"), defaultString(payload.IconKind, "builtin"), strings.TrimSpace(payload.IconURL), boolInt(payload.Featured), boolInt(payload.Visible), boolInt(payload.ConnectivityEnabled), id); err != nil {
		return link{}, err
	}
	var result link
	var featured, visible int
	var connectivityEnabled int
	if err := s.db.QueryRow("SELECT id, name, description, url, icon, icon_kind, icon_url, category_id, featured, visible, connectivity_enabled FROM links WHERE id = ?", id).Scan(&result.ID, &result.Name, &result.Description, &result.URL, &result.Icon, &result.IconKind, &result.IconURL, &result.CategoryID, &featured, &visible, &connectivityEnabled); err != nil {
		return result, err
	}
	result.Featured = featured == 1
	result.Visible = visible == 1
	result.ConnectivityEnabled = connectivityEnabled == 1
	return result, nil
}

func (s *store) updateSettings(payload settingsPayload) error {
	timezone, err := resolveTimezone(payload.Timezone)
	if err != nil {
		return err
	}
	values := map[string]string{
		"brand_name":        defaultString(payload.BrandName, "KitonyNav"),
		"brand_description": defaultString(payload.BrandDescription, "把常用的站点，放在顺手的位置。"),
		"default_engine":    defaultString(payload.DefaultEngine, "Google"),
		"weather_location":  defaultString(payload.WeatherLocation, "上海市"),
		"timezone":          timezone,
		"theme_default":     defaultEnum(payload.Theme, "system", "system", "light", "dark"),
		"clock_style":       defaultEnum(payload.ClockStyle, "plain", "plain", "flip", "ticker", "glow"),
		"clock_24_hour":     strconv.FormatBool(payload.Clock24Hour),
		"clock_seconds":     strconv.FormatBool(payload.ClockSeconds),
		"clock_color":       defaultString(payload.ClockColor, "#2f6ff3"),
		"clock_speed":       strconv.Itoa(defaultInt(payload.ClockSpeed, 1)),
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

func defaultEnum(value, fallback string, allowed ...string) string {
	value = strings.TrimSpace(value)
	for _, candidate := range allowed {
		if value == candidate {
			return value
		}
	}
	return fallback
}

var errInvalidTimezone = errors.New("时区不正确")

// resolveTimezone 只接受 IANA 时区名称；空值回落站点默认时区。非法名称会让所有时间格式化失败，必须在写入前拦住。
func resolveTimezone(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "Asia/Shanghai", nil
	}
	if _, err := time.LoadLocation(value); err != nil {
		return "", errInvalidTimezone
	}
	return value, nil
}

func (s *store) services() ([]serviceStatus, error) {
	rows, err := s.db.Query("SELECT id, name, status, latency_ms, updated_at, enabled, check_type, target, port, source_status, source_updated_at, source_error FROM services ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]serviceStatus, 0)
	for rows.Next() {
		var item serviceStatus
		var latency, port sql.NullInt64
		var enabled int
		if err := rows.Scan(&item.ID, &item.Name, &item.Status, &latency, &item.UpdatedAt, &enabled, &item.CheckType, &item.Target, &port, &item.SourceStatus, &item.SourceUpdatedAt, &item.SourceError); err != nil {
			return nil, err
		}
		item.Enabled = enabled == 1
		if latency.Valid {
			value := int(latency.Int64)
			item.LatencyMS = &value
		}
		if port.Valid {
			value := int(port.Int64)
			item.Port = &value
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *store) insertService(payload servicePayload) (serviceStatus, error) {
	checkType := defaultEnum(payload.CheckType, "none", "none", "http", "tcp")
	if checkType == "http" && !validHTTPURL(payload.Target) {
		return serviceStatus{}, errors.New("HTTP 检查地址不正确")
	}
	if checkType == "tcp" && (strings.TrimSpace(payload.Target) == "" || payload.Port < 1 || payload.Port > 65535) {
		return serviceStatus{}, errors.New("TCP 检查目标或端口不正确")
	}
	result, err := s.db.Exec("INSERT INTO services(name, status, updated_at, enabled, check_type, target, port, source_status) VALUES (?, 'unknown', ?, ?, ?, ?, ?, 'unknown')", defaultString(payload.Name, "未命名服务"), time.Now().UTC().Format(time.RFC3339), boolInt(payload.Enabled), checkType, strings.TrimSpace(payload.Target), nullablePort(payload.Port))
	if err != nil {
		return serviceStatus{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return serviceStatus{}, err
	}
	items, err := s.services()
	if err != nil {
		return serviceStatus{}, err
	}
	for _, item := range items {
		if item.ID == int(id) {
			return item, nil
		}
	}
	return serviceStatus{}, sql.ErrNoRows
}

func (s *store) updateService(id int, payload servicePayload) (serviceStatus, error) {
	checkType := defaultEnum(payload.CheckType, "none", "none", "http", "tcp")
	if checkType == "http" && !validHTTPURL(payload.Target) {
		return serviceStatus{}, errors.New("HTTP 检查地址不正确")
	}
	if checkType == "tcp" && (strings.TrimSpace(payload.Target) == "" || payload.Port < 1 || payload.Port > 65535) {
		return serviceStatus{}, errors.New("TCP 检查目标或端口不正确")
	}
	if _, err := s.db.Exec("UPDATE services SET name = ?, enabled = ?, check_type = ?, target = ?, port = ?, status = CASE WHEN check_type <> ? OR target <> ? OR COALESCE(port, 0) <> ? THEN 'unknown' ELSE status END WHERE id = ?", defaultString(payload.Name, "未命名服务"), boolInt(payload.Enabled), checkType, strings.TrimSpace(payload.Target), nullablePort(payload.Port), checkType, strings.TrimSpace(payload.Target), payload.Port, id); err != nil {
		return serviceStatus{}, err
	}
	for _, item := range mustServices(s) {
		if item.ID == id {
			return item, nil
		}
	}
	return serviceStatus{}, sql.ErrNoRows
}

func mustServices(s *store) []serviceStatus { items, _ := s.services(); return items }

func nullablePort(port int) any {
	if port <= 0 {
		return nil
	}
	return port
}

func (s *store) deleteService(id int) error {
	_, err := s.db.Exec("DELETE FROM services WHERE id = ?", id)
	return err
}

func (s *store) updateServiceResult(id int, status string, latency *int, sourceError string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec("UPDATE services SET status = ?, latency_ms = ?, updated_at = ?, source_status = ?, source_updated_at = ?, source_error = ? WHERE id = ?", status, latency, now, status, now, sourceError, id)
	return err
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
	mux.HandleFunc("POST /api/v1/admin/services", s.requireWrite(s.handleCreateService))
	mux.HandleFunc("PUT /api/v1/admin/services/{id}", s.requireWrite(s.handleUpdateService))
	mux.HandleFunc("DELETE /api/v1/admin/services/{id}", s.requireWrite(s.handleDeleteService))
	mux.HandleFunc("POST /api/v1/admin/services/{id}/refresh", s.requireWrite(s.handleRefreshService))
	mux.HandleFunc("POST /api/v1/admin/subscriptions", s.requireWrite(s.handleCreateSubscription))
	mux.HandleFunc("PUT /api/v1/admin/subscriptions/{id}", s.requireWrite(s.handleUpdateSubscription))
	mux.HandleFunc("DELETE /api/v1/admin/subscriptions/{id}", s.requireWrite(s.handleDeleteSubscription))
	mux.HandleFunc("POST /api/v1/admin/subscriptions/{id}/refresh", s.requireWrite(s.handleRefreshSubscription))
	mux.HandleFunc("GET /api/v1/network/client", s.handleClientNetwork)
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
	// 后台写入后要立刻可见，因此只做 ETag 协商缓存，不允许直接用未校验的本地副本。
	w.Header().Set("Cache-Control", "no-cache")
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
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validIconSpec(payload.IconKind, payload.IconURL) {
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
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validIconSpec(payload.IconKind, payload.IconURL) {
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
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validHTTPURL(payload.URL) || payload.CategoryID <= 0 || !validIconSpec(payload.IconKind, payload.IconURL) {
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
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" || !validHTTPURL(payload.URL) || payload.CategoryID <= 0 || !validIconSpec(payload.IconKind, payload.IconURL) {
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
		if errors.Is(err, errInvalidTimezone) {
			writeError(w, http.StatusBadRequest, "时区不正确，请填写 IANA 时区名称，例如 Asia/Shanghai")
			return
		}
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

func (s *appServer) handleCreateService(w http.ResponseWriter, r *http.Request) {
	var payload servicePayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
		writeError(w, http.StatusBadRequest, "服务名称不能为空")
		return
	}
	item, err := s.store.insertService(payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *appServer) handleUpdateService(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "服务 ID 不正确")
		return
	}
	var payload servicePayload
	if err := decodeJSON(r, &payload); err != nil || strings.TrimSpace(payload.Name) == "" {
		writeError(w, http.StatusBadRequest, "服务名称不能为空")
		return
	}
	item, err := s.store.updateService(id, payload)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "服务不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *appServer) handleDeleteService(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "服务 ID 不正确")
		return
	}
	if err := s.store.deleteService(id); err != nil {
		writeError(w, http.StatusInternalServerError, "删除服务失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *appServer) handleRefreshService(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "服务 ID 不正确")
		return
	}
	items, err := s.store.services()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取服务失败")
		return
	}
	var service serviceStatus
	for _, item := range items {
		if item.ID == id {
			service = item
			break
		}
	}
	if service.ID == 0 {
		writeError(w, http.StatusNotFound, "服务不存在")
		return
	}
	if !service.Enabled {
		writeError(w, http.StatusBadRequest, "服务已停用")
		return
	}
	status, latency, checkErr := checkConfiguredService(service)
	if err := s.store.updateServiceResult(id, status, latency, errorText(checkErr)); err != nil {
		writeError(w, http.StatusInternalServerError, "保存服务状态失败")
		return
	}
	if checkErr != nil {
		writeError(w, http.StatusBadGateway, checkErr.Error())
		return
	}
	updated, _ := s.store.services()
	for _, item := range updated {
		if item.ID == id {
			writeJSON(w, http.StatusOK, item)
			return
		}
	}
	writeJSON(w, http.StatusOK, service)
}

func checkConfiguredService(service serviceStatus) (string, *int, error) {
	started := time.Now()
	switch service.CheckType {
	case "tcp":
		if service.Target == "" || service.Port == nil {
			return "unknown", nil, errors.New("TCP 目标未配置")
		}
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(service.Target, strconv.Itoa(*service.Port)), 5*time.Second)
		if err != nil {
			return "offline", nil, err
		}
		_ = conn.Close()
		latency := int(time.Since(started).Milliseconds())
		return "online", &latency, nil
	case "http":
		if !validHTTPURL(service.Target) {
			return "unknown", nil, errors.New("HTTP 目标未配置")
		}
		client := &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 2 {
				return errors.New("重定向次数过多")
			}
			return nil
		}}
		request, err := http.NewRequest(http.MethodGet, service.Target, nil)
		if err != nil {
			return "unknown", nil, err
		}
		request.Header.Set("User-Agent", "KitonyNav/0.0.2")
		response, err := client.Do(request)
		if err != nil {
			return "offline", nil, err
		}
		defer response.Body.Close()
		_, _ = io.CopyN(io.Discard, response.Body, 64<<10)
		latency := int(time.Since(started).Milliseconds())
		if response.StatusCode >= 500 {
			return "offline", &latency, fmt.Errorf("HTTP %d", response.StatusCode)
		}
		if response.StatusCode >= 400 {
			return "degraded", &latency, fmt.Errorf("HTTP %d", response.StatusCode)
		}
		return "online", &latency, nil
	default:
		return "unknown", nil, errors.New("未配置检查方式")
	}
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func (s *appServer) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	var payload subscriptionPayload
	if err := decodeJSON(r, &payload); err != nil || !validSubscription(payload) {
		writeError(w, http.StatusBadRequest, "订阅类型、名称或地址不正确")
		return
	}
	item, err := s.store.insertSubscription(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存订阅失败")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *appServer) handleUpdateSubscription(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "订阅 ID 不正确")
		return
	}
	var payload subscriptionPayload
	if err := decodeJSON(r, &payload); err != nil || !validSubscription(payload) {
		writeError(w, http.StatusBadRequest, "订阅类型、名称或地址不正确")
		return
	}
	item, err := s.store.updateSubscription(id, payload)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "订阅不存在")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "保存订阅失败")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *appServer) handleDeleteSubscription(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "订阅 ID 不正确")
		return
	}
	if _, err := s.store.db.Exec("DELETE FROM subscriptions WHERE id = ?", id); err != nil {
		writeError(w, http.StatusInternalServerError, "删除订阅失败")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *appServer) handleRefreshSubscription(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "订阅 ID 不正确")
		return
	}
	if err := s.store.refreshSubscription(id); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	for _, item := range mustSubscriptions(s.store) {
		if item.ID == id {
			writeJSON(w, http.StatusOK, item)
			return
		}
	}
	writeError(w, http.StatusNotFound, "订阅不存在")
}

func validSubscription(payload subscriptionPayload) bool {
	if payload.Type != "rss" && payload.Type != "github" && payload.Type != "youtube" {
		return false
	}
	if payload.Type == "github" {
		parts := strings.Split(strings.Trim(payload.URL, "/"), "/")
		return len(parts) == 2 && parts[0] != "" && parts[1] != ""
	}
	return validHTTPURL(payload.URL)
}

func (s *appServer) handleClientNetwork(w http.ResponseWriter, r *http.Request) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		writeJSON(w, http.StatusOK, networkInfo{Status: "unavailable", Source: "http"})
		return
	}
	family := "IPv4"
	if ip.To4() == nil {
		family = "IPv6"
	}
	writeJSON(w, http.StatusOK, networkInfo{Address: host, Family: family, Source: "http", Status: "available"})
}

func pathID(r *http.Request, key string) (int, error) { return strconv.Atoi(r.PathValue(key)) }

func validHTTPURL(value string) bool {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(value))
	return err == nil && parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func validIconSpec(kind, value string) bool {
	kind = defaultString(kind, "builtin")
	if kind == "builtin" {
		return true
	}
	if kind != "url" {
		return false
	}
	value = strings.TrimSpace(value)
	return validHTTPURL(value) || (strings.HasPrefix(value, "/") && !strings.HasPrefix(value, "//"))
}

// safeExternalHTTPURL 拒绝内网与保留地址，并给出可定位的错误原因。
func safeExternalHTTPURL(value string) error {
	if !validHTTPURL(value) {
		return errors.New("地址不正确")
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return errors.New("地址不正确")
	}
	host := parsed.Hostname()
	addresses, err := net.LookupIP(host)
	if err != nil || len(addresses) == 0 {
		return fmt.Errorf("地址无法解析：%s", host)
	}
	for _, address := range addresses {
		if address.IsLoopback() || address.IsPrivate() || address.IsLinkLocalUnicast() || address.IsUnspecified() || address.IsMulticast() {
			// 内网目标，或本机代理把域名解析到 198.18.0.0/15 这类保留网段。
			return fmt.Errorf("地址解析到内网或保留地址：%s", host)
		}
	}
	return nil
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
			// 构建产物带内容哈希，可以长期缓存；入口 HTML 与品牌资源必须每次校验。
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			files.ServeHTTP(w, r)
			return
		}
		// 未命中的前端路由回落到入口 HTML；不能缓存，否则旧 HTML 会一直指向已删除的资源。
		w.Header().Set("Cache-Control", "no-cache")
		fallback := r.Clone(r.Context())
		fallback.URL.Path = "/"
		files.ServeHTTP(w, fallback)
	})
}

func refreshLoop(ctx context.Context, data *store) {
	refreshConfiguredData(data)
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			refreshConfiguredData(data)
			_, _ = data.db.Exec("INSERT INTO settings(key, value) VALUES ('last_refresh_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", time.Now().UTC().Format(time.RFC3339))
		}
	}
}

func refreshConfiguredData(data *store) {
	for _, service := range mustServices(data) {
		if service.Enabled && service.CheckType != "none" {
			status, latency, err := checkConfiguredService(service)
			_ = data.updateServiceResult(service.ID, status, latency, errorText(err))
		}
	}
	for _, item := range mustSubscriptions(data) {
		if item.Enabled {
			_ = data.refreshSubscription(item.ID)
		}
	}
}
