package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type result struct {
	OK        bool   `json:"ok"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
	LatencyMS int64  `json:"latencyMs,omitempty"`
	Error     string `json:"error,omitempty"`
}

func main() {
	listen := flag.String("listen", "127.0.0.1:4711", "本机探针监听地址")
	allow := flag.String("allow", "", "允许检测的目标，逗号分隔，例如 github.com:443,example.com:443")
	flag.Parse()
	allowed := parseAllowlist(*allow)
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/tcping", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		host := strings.TrimSpace(r.URL.Query().Get("host"))
		port, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("port")))
		if host == "" || err != nil || port < 1 || port > 65535 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "host 或 port 不正确"})
			return
		}
		key := net.JoinHostPort(host, strconv.Itoa(port))
		if !allowed[key] {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "目标不在探针 allowlist 中"})
			return
		}
		started := time.Now()
		conn, err := net.DialTimeout("tcp", key, 5*time.Second)
		if err != nil {
			writeJSON(w, http.StatusOK, result{OK: false, Host: host, Port: port, Error: err.Error()})
			return
		}
		_ = conn.Close()
		writeJSON(w, http.StatusOK, result{OK: true, Host: host, Port: port, LatencyMS: time.Since(started).Milliseconds()})
	})
	server := &http.Server{Addr: *listen, Handler: cors(mux), ReadHeaderTimeout: 3 * time.Second}
	fmt.Printf("KitonyNav probe listening on http://%s\n", *listen)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		panic(err)
	}
}

func parseAllowlist(value string) map[string]bool {
	allowed := map[string]bool{}
	for _, item := range strings.Split(value, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			allowed[item] = true
		}
	}
	return allowed
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
