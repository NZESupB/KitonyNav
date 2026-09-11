package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestBootstrapSeedsCategoriesAndUpdates(t *testing.T) {
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
	if len(bootstrap.Updates) != 5 {
		t.Fatalf("expected seeded updates, got %d", len(bootstrap.Updates))
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
	if len(bootstrap.Services) == 0 || bootstrap.Services[0].CheckType != "none" {
		t.Fatalf("expected migrated service defaults: %+v", bootstrap.Services)
	}
	if bootstrap.Services[0].Enabled != true {
		t.Fatalf("expected migrated service to remain enabled")
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
	if safeExternalHTTPURL("http://127.0.0.1:8080/feed.xml") {
		t.Fatal("loopback subscription targets must be rejected")
	}
	if safeExternalHTTPURL("http://localhost/feed.xml") {
		t.Fatal("localhost subscription targets must be rejected")
	}
}

func TestMain(m *testing.M) { os.Exit(m.Run()) }
