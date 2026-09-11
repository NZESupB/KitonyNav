package main

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestBootstrapSeedsNavigationContentAndDefaultSubscription(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	bootstrap, err := data.bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if len(bootstrap.Categories) < 5 {
		t.Fatalf("expected seeded categories, got %d", len(bootstrap.Categories))
	}
	// 默认不预置任何演示动态与演示服务状态。
	if len(bootstrap.Updates) != 0 {
		t.Fatalf("expected no demo updates, got %d", len(bootstrap.Updates))
	}
	if len(bootstrap.Services) != 0 {
		t.Fatalf("expected no demo services, got %d", len(bootstrap.Services))
	}
	if len(bootstrap.Subscriptions) != 1 {
		t.Fatalf("expected exactly one default subscription, got %+v", bootstrap.Subscriptions)
	}
	item := bootstrap.Subscriptions[0]
	if item.Type != "github" || item.URL != defaultSubscriptionSource || !item.Enabled {
		t.Fatalf("expected the project GitHub feed as the only default subscription, got %+v", item)
	}
}

func TestDataDefaultsRunOnce(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	if _, err := data.db.Exec("INSERT INTO updates(source, title, time_text, url, sort_order) VALUES ('GitHub', 'React 19.1 正式发布', '2 天前', 'https://github.com/facebook/react/releases', 1)"); err != nil {
		t.Fatal(err)
	}
	// 模拟升级：重新执行默认数据步骤应清掉旧演示动态，重复执行也不会重复添加订阅。
	if _, err := data.db.Exec("DELETE FROM settings WHERE key = 'data_defaults_v1'"); err != nil {
		t.Fatal(err)
	}
	if err := applyDataDefaults(data.db); err != nil {
		t.Fatal(err)
	}
	if err := applyDataDefaults(data.db); err != nil {
		t.Fatal(err)
	}
	bootstrap, err := data.bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if len(bootstrap.Updates) != 0 {
		t.Fatalf("expected legacy demo updates to be cleared, got %d", len(bootstrap.Updates))
	}
	if len(bootstrap.Subscriptions) != 1 {
		t.Fatalf("expected exactly one default subscription, got %d", len(bootstrap.Subscriptions))
	}
	// 用户自己删掉默认订阅后，不应该被再加回来。
	if _, err := data.db.Exec("DELETE FROM subscriptions"); err != nil {
		t.Fatal(err)
	}
	if err := applyDataDefaults(data.db); err != nil {
		t.Fatal(err)
	}
	if items := mustSubscriptions(data); len(items) != 0 {
		t.Fatalf("expected a deleted subscription to stay deleted, got %+v", items)
	}
}

func TestAdminRequiresAuthAndCSRF(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	app := &appServer{store: data, auth: newAuthManager("secret", false)}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/categories", nil)
	res := httptest.NewRecorder()
	app.routes().ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestValidHTTPURL(t *testing.T) {
	if !validHTTPURL("https://example.com/path") {
		t.Fatal("expected https URL to be valid")
	}
	if validHTTPURL("javascript:alert(1)") {
		t.Fatal("javascript URL must be rejected")
	}
}

func TestBootstrapUsesETag(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	app := &appServer{store: data, auth: newAuthManager("secret", false)}
	first := httptest.NewRecorder()
	app.handleBootstrap(first, httptest.NewRequest(http.MethodGet, "/api/v1/bootstrap", nil))
	etag := first.Header().Get("ETag")
	if etag == "" || first.Code != http.StatusOK {
		t.Fatalf("expected bootstrap ETag, got code=%d etag=%q", first.Code, etag)
	}
	secondRequest := httptest.NewRequest(http.MethodGet, "/api/v1/bootstrap", nil)
	secondRequest.Header.Set("If-None-Match", etag)
	second := httptest.NewRecorder()
	app.handleBootstrap(second, secondRequest)
	if second.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", second.Code)
	}
}

func TestV002BootstrapIncludesAppearanceAndMonitorDefaults(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	bootstrap, err := data.bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if bootstrap.Settings.Appearance.Theme != "system" || bootstrap.Settings.Appearance.ClockStyle != "plain" {
		t.Fatalf("unexpected appearance defaults: %+v", bootstrap.Settings.Appearance)
	}
	item, err := data.insertService(servicePayload{Name: "示例服务", Enabled: true})
	if err != nil {
		t.Fatal(err)
	}
	if item.CheckType != "none" || !item.Enabled {
		t.Fatalf("expected new service defaults, got %+v", item)
	}
}

func TestParseGitHubReleases(t *testing.T) {
	items, err := parseGitHubReleases([]byte(`[{"id":42,"tag_name":"v0.2.0","name":"","html_url":"https://github.com/o/r/releases/tag/v0.2.0","published_at":"2026-09-10T00:00:00Z"}]`))
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].title != "v0.2.0" || items[0].externalID != "42" || items[0].published != "2026-09-10T00:00:00Z" {
		t.Fatalf("unexpected release entries: %+v", items)
	}
	if _, err := parseGitHubReleases([]byte("<html>")); err == nil {
		t.Fatal("expected a non-JSON releases response to be rejected")
	}
}

func TestParseGitHubTagFeed(t *testing.T) {
	body := `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>tag:github.com,2008:/NZESupB/KitonyNav/tags</id>
  <title>Tags from KitonyNav</title>
  <updated>2026-09-11T07:54:38Z</updated>
  <entry>
    <id>tag:github.com,2008:Repository/1364020270/v0.1.1</id>
    <title>v0.1.1</title>
    <updated>2026-09-11T07:54:38Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/NZESupB/KitonyNav/releases/tag/v0.1.1"/>
  </entry>
</feed>`
	items, err := parseFeedDocument([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one tag entry, got %+v", items)
	}
	if items[0].title != "v0.1.1" || items[0].published != "2026-09-11T07:54:38Z" || !strings.HasSuffix(items[0].url, "/releases/tag/v0.1.1") {
		t.Fatalf("unexpected tag entry: %+v", items[0])
	}
}

func TestConfiguredTCPServiceCheck(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	address, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	portNumber, err := strconv.Atoi(port)
	if err != nil {
		t.Fatal(err)
	}
	service := serviceStatus{CheckType: "tcp", Target: address, Port: &portNumber}
	status, latency, checkErr := checkConfiguredService(service)
	if checkErr != nil || status != "online" || latency == nil {
		t.Fatalf("expected successful TCP check, status=%s latency=%v err=%v", status, latency, checkErr)
	}
}

func TestSubscriptionValidation(t *testing.T) {
	if !validSubscription(subscriptionPayload{Type: "github", URL: "facebook/react"}) {
		t.Fatal("expected owner/repo GitHub subscription to be valid")
	}
	if validSubscription(subscriptionPayload{Type: "github", URL: "https://github.com/facebook/react"}) {
		t.Fatal("expected GitHub subscription to reject non owner/repo input")
	}
	if validSubscription(subscriptionPayload{Type: "rss", URL: "javascript:alert(1)"}) {
		t.Fatal("expected RSS subscription to reject script URLs")
	}
}

func TestValidIconSpec(t *testing.T) {
	if !validIconSpec("builtin", "") || !validIconSpec("url", "https://example.com/icon.png") || !validIconSpec("url", "/brand/icon.svg") {
		t.Fatal("expected safe icon specs to be accepted")
	}
	if validIconSpec("url", "data:image/svg+xml,<svg></svg>") || validIconSpec("url", "//example.com/icon.png") {
		t.Fatal("unsafe icon specs must be rejected")
	}
}

func TestSafeExternalHTTPURLRejectsPrivateTargets(t *testing.T) {
	if err := safeExternalHTTPURL("http://127.0.0.1:8080/feed.xml"); err == nil {
		t.Fatal("loopback subscription targets must be rejected")
	}
	if err := safeExternalHTTPURL("http://localhost/feed.xml"); err == nil {
		t.Fatal("localhost subscription targets must be rejected")
	}
	if err := safeExternalHTTPURL("javascript:alert(1)"); err == nil {
		t.Fatal("non-HTTP subscription targets must be rejected")
	}
}

func TestBootstrapKeepsEmptyListsAsArrays(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	if _, err := data.db.Exec("DELETE FROM links; DELETE FROM categories; DELETE FROM services; DELETE FROM updates"); err != nil {
		t.Fatal(err)
	}
	bootstrap, err := data.bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	payload, err := json.Marshal(bootstrap)
	if err != nil {
		t.Fatal(err)
	}
	// 前端按数组消费这些字段，返回 null 会在渲染期抛错并让整页白屏。
	for _, field := range []string{`"categories":[]`, `"services":[]`, `"updates":[]`} {
		if !strings.Contains(string(payload), field) {
			t.Fatalf("expected %s in bootstrap payload, got %s", field, payload)
		}
	}
}

func TestUpdateSettingsValidatesTimezone(t *testing.T) {
	dir := t.TempDir()
	data, err := openStore(filepath.Join(dir, "kitonynav.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer data.db.Close()
	if err := data.updateSettings(settingsPayload{Timezone: "Mars/Olympus"}); !errors.Is(err, errInvalidTimezone) {
		t.Fatalf("expected invalid timezone to be rejected, got %v", err)
	}
	if err := data.updateSettings(settingsPayload{BrandName: "KitonyNav", Timezone: "Asia/Shanghai"}); err != nil {
		t.Fatalf("expected valid timezone to be accepted, got %v", err)
	}
	bootstrap, err := data.bootstrap()
	if err != nil {
		t.Fatal(err)
	}
	if bootstrap.Settings.Timezone != "Asia/Shanghai" {
		t.Fatalf("expected stored timezone, got %q", bootstrap.Settings.Timezone)
	}
}

func TestMain(m *testing.M) { os.Exit(m.Run()) }
