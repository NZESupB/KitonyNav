package main

import (
	"context"
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
	LatencyMS *int64 `json:"latencyMs,omitempty"`
	Error     string `json:"error,omitempty"`
	ErrorCode string `json:"errorCode,omitempty"`
}

func main() {
	listen := flag.String("listen", "127.0.0.1:4711", "本机探针监听地址")
	allow := flag.String("allow", "", "允许检测的目标，逗号分隔，例如 github.com:443,example.com:443")
	flag.Parse()
	server := &http.Server{Addr: *listen, Handler: cors(probeHandler(parseAllowlist(*allow))), ReadHeaderTimeout: 3 * time.Second}
	fmt.Printf("KitonyNav probe listening on http://%s\n", *listen)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		panic(err)
	}
}

func probeHandler(allowed map[string]bool) http.Handler {
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
			writeJSON(w, http.StatusBadRequest, result{Error: "host 或 port 不正确", ErrorCode: "invalid-target"})
			return
		}
		key := net.JoinHostPort(host, strconv.Itoa(port))
		if !allowed[key] {
			writeJSON(w, http.StatusForbidden, result{Host: host, Port: port, Error: "目标不在探针 allowlist 中", ErrorCode: "not-allowed"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		started := time.Now()
		conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", key)
		if err != nil {
			code := "tcp-failed"
			if timeout, ok := err.(net.Error); ok && timeout.Timeout() {
				code = "tcp-timeout"
			}
			writeJSON(w, http.StatusOK, result{OK: false, Host: host, Port: port, Error: err.Error(), ErrorCode: code})
			return
		}
		latency := time.Since(started).Milliseconds()
		_ = conn.Close()
		// 指针保留成功的 0ms；失败时不输出未测得的延迟。
		writeJSON(w, http.StatusOK, result{OK: true, Host: host, Port: port, LatencyMS: &latency})
	})
	return mux
}

func parseAllowlist(value string) map[string]bool {
	allowed := map[string]bool{}
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
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
