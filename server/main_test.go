package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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

func TestMain(m *testing.M) { os.Exit(m.Run()) }
