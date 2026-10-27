package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"sort"
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
	listen := flag.String("listen", "127.0.0.1:4711", "本机回环监听地址，仅支持 HTTP")
	allow := flag.String("allow", "", "允许检测的 host:port，逗号分隔")
	origins := flag.String("origins", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173", "允许的网页来源，逗号分隔；线上来源需显式添加")
	flag.Parse()
	address, err := loopbackAddress(*listen)
	if err != nil {
		log.Fatal(err)
	}
	allowed, err := parseAllowlist(*allow)
	if err != nil {
		log.Fatal(err)
	}
	allowedOrigins, err := parseOrigins(*origins)
	if err != nil {
		log.Fatal(err)
	}
	if len(allowed) == 0 {
		log.Print("目标白名单为空，不会检测任何目标；请通过 --allow 指定 host:port")
	}
	server := &http.Server{Addr: address, Handler: cors(probeHandler(allowed), allowedOrigins), ReadHeaderTimeout: 3 * time.Second}
	fmt.Printf("KitonyNav probe listening on http://%s\n", address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func probeHandler(allowed map[string]bool) http.Handler {
	targets := make([]string, 0, len(allowed))
	for target := range allowed {
		targets = append(targets, target)
	}
	sort.Strings(targets)
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "service": "kitonynav-probe", "protocolVersion": 1, "allowedTargets": targets})
	})
	mux.HandleFunc("/tcping", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		key, err := normalizeTarget(net.JoinHostPort(strings.TrimSpace(r.URL.Query().Get("host")), strings.TrimSpace(r.URL.Query().Get("port"))))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, result{Error: "host 或 port 不正确", ErrorCode: "invalid-target"})
			return
		}
		host, portText, _ := net.SplitHostPort(key)
		port, _ := strconv.Atoi(portText)
		if !allowed[key] {
			writeJSON(w, http.StatusForbidden, result{Host: host, Port: port, Error: "目标不在探针 allowlist 中：" + key, ErrorCode: "not-allowed"})
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

func normalizeTarget(value string) (string, error) {
	host, portText, err := net.SplitHostPort(value)
	port, portErr := strconv.Atoi(portText)
	if err != nil || portErr != nil || port < 1 || port > 65535 || strings.Trim(portText, "0123456789") != "" {
		return "", fmt.Errorf("非法目标 %q，必须为 host:port，端口为 1–65535", value)
	}
	host = strings.TrimSuffix(strings.ToLower(host), ".")
	if ip := net.ParseIP(host); ip != nil {
		host = ip.String()
	} else {
		if len(host) == 0 || len(host) > 253 {
			return "", fmt.Errorf("非法目标主机 %q", host)
		}
		for _, label := range strings.Split(host, ".") {
			if len(label) == 0 || len(label) > 63 || strings.HasPrefix(label, "-") || strings.HasSuffix(label, "-") {
				return "", fmt.Errorf("非法目标主机 %q", host)
			}
			for _, char := range label {
				if !(char >= 'a' && char <= 'z' || char >= '0' && char <= '9' || char == '-') {
					return "", fmt.Errorf("非法目标主机 %q，国际域名请使用 punycode", host)
				}
			}
		}
	}
	return net.JoinHostPort(host, strconv.Itoa(port)), nil
}

func loopbackAddress(value string) (string, error) {
	key, err := normalizeTarget(value)
	if err != nil {
		return "", err
	}
	host, port, _ := net.SplitHostPort(key)
	if host == "localhost" {
		host = "127.0.0.1"
	}
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		return "", fmt.Errorf("探针仅允许监听回环 IP 或 localhost")
	}
	return net.JoinHostPort(host, port), nil
}

func parseAllowlist(value string) (map[string]bool, error) {
	allowed := map[string]bool{}
	if strings.TrimSpace(value) == "" {
		return allowed, nil
	}
	for _, item := range strings.Split(value, ",") {
		key, err := normalizeTarget(strings.TrimSpace(item))
		if err != nil {
			return nil, err
		}
		allowed[key] = true
	}
	return allowed, nil
}

func parseOrigins(value string) (map[string]bool, error) {
	origins := map[string]bool{}
	for _, item := range strings.Split(value, ",") {
		u, err := url.Parse(strings.TrimSpace(item))
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil ||
			(u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.Contains(u.Host, "*") {
			return nil, fmt.Errorf("非法网页来源 %q，必须为完整 HTTP(S) origin", item)
		}
		port := u.Port()
		if port == "" {
			if u.Scheme == "https" {
				port = "443"
			} else {
				port = "80"
			}
		}
		key, err := normalizeTarget(net.JoinHostPort(u.Hostname(), port))
		if err != nil {
			return nil, fmt.Errorf("非法网页来源 %q: %w", item, err)
		}
		host, normalizedPort, _ := net.SplitHostPort(key)
		if (u.Scheme == "http" && normalizedPort == "80") || (u.Scheme == "https" && normalizedPort == "443") {
			key = host
			if strings.Contains(host, ":") {
				key = "[" + host + "]"
			}
		}
		origins[u.Scheme+"://"+key] = true
	}
	return origins, nil
}

func cors(next http.Handler, origins map[string]bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Add("Vary", "Origin")
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !origins[origin] {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "网页来源未获允许，请核对 --origins", "errorCode": "origin-not-allowed"})
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.Header().Add("Vary", "Access-Control-Request-Private-Network")
			if method := r.Header.Get("Access-Control-Request-Method"); method != "" && method != http.MethodGet {
				writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
				return
			}
			// 兼容旧 PNA 预检；不替代浏览器本地网络权限。
			if origin != "" && r.Header.Get("Access-Control-Request-Private-Network") == "true" {
				w.Header().Set("Access-Control-Allow-Private-Network", "true")
			}
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
