import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createSubscription,
  deleteSubscription,
  refreshSubscription,
  updateSubscription,
} from "../../api";
import { FormControlsDisabled, ThemedSelect } from "../../components/ui/ThemedSelect";
import { useSaveMutation } from "../../hooks/use-save-mutation";
import type { BootstrapData, Subscription } from "../../data";
import {
  emptySubscriptionDraft,
  type AdminFeedback,
  type SubscriptionDraft,
} from "./types";

function SubscriptionForm({
  editing,
  draft,
  onChange,
  onSubmit,
  onCancel,
}: {
  editing: Subscription | null;
  draft: SubscriptionDraft;
  onChange: (patch: Partial<SubscriptionDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="editor-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">{editing ? "编辑订阅" : "新建订阅"}</span>
          <h2>{editing ? editing.name : "添加关注内容"}</h2>
        </div>
      </div>
      <label>
        类型
        <ThemedSelect
          aria-label="类型"
          value={draft.type}
          onValueChange={(value) => onChange({ type: value as Subscription["type"] })}
          options={[
            { value: "rss", label: "RSS / Atom" },
            { value: "github", label: "GitHub Releases" },
            { value: "youtube", label: "YouTube 频道" },
          ]}
        />
      </label>
      <label>
        名称
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="例如：少数派"
        />
      </label>
      <label>
        {draft.type === "github" ? "仓库（owner/repo）" : "Feed 地址"}
        <input
          value={draft.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder={draft.type === "github" ? "facebook/react" : "https://example.com/feed.xml"}
          inputMode="url"
        />
      </label>
      <label>
        刷新间隔（秒）
        <input
          value={draft.intervalSeconds}
          onChange={(event) => onChange({ intervalSeconds: event.target.value })}
          inputMode="numeric"
        />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />{" "}
        在最近动态中显示
      </label>
      <div className="form-actions">
        <button type="button" className="quiet-button" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={!draft.name.trim() || !draft.url.trim()}
        >
          <Check size={16} /> 保存订阅
        </button>
      </div>
    </section>
  );
}

export function SubscriptionsTab({
  data,
  onFeedback,
}: {
  data: BootstrapData;
  onFeedback: (feedback: AdminFeedback) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [draft, setDraft] = useState<SubscriptionDraft>(emptySubscriptionDraft);

  const reset = () => {
    setEditing(null);
    setDraft(emptySubscriptionDraft);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const mutation = useSaveMutation(
    createSubscription,
    updateSubscription,
    () => {
      onFeedback({ kind: "success", message: "订阅已保存" });
      reset();
      void refresh();
    },
    (error) => onFeedback({ kind: "error", message: error.message || "订阅保存失败" }),
  );

  const deleteMut = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => {
      onFeedback({ kind: "success", message: "订阅已删除" });
      refresh();
    },
    onError: (error: Error) => onFeedback({ kind: "error", message: error.message || "删除失败" }),
  });

  const refreshMut = useMutation({
    mutationFn: refreshSubscription,
    onSuccess: () => {
      onFeedback({ kind: "success", message: "订阅已刷新" });
      refresh();
    },
    onError: (error: Error) => onFeedback({ kind: "error", message: error.message || "订阅刷新失败" }),
  });

  const busy = mutation.isPending || deleteMut.isPending || refreshMut.isPending;

  const startEdit = (item: Subscription) => {
    setEditing(item);
    setDraft({
      type: item.type,
      name: item.name,
      url: item.url,
      enabled: item.enabled,
      intervalSeconds: String(item.intervalSeconds || 900),
    });
  };

  return (
    <FormControlsDisabled.Provider value={busy}>
      <fieldset className="admin-fields" disabled={busy} aria-busy={busy}>
        <div className="admin-grid">
          <section className="admin-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">关注内容</span>
                <h2>动态订阅</h2>
              </div>
              <button type="button" className="primary-button" onClick={reset}>
                <Plus size={16} /> 新增订阅
              </button>
            </div>
            <div className="admin-list">
              {(data.subscriptions ?? []).map((item) => (
                <div className="admin-list-row" key={item.id}>
                  <span className={`source-dot ${item.type}`} />
                  <span className="admin-item-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {item.type.toUpperCase()} · {item.itemCount ?? 0} 条缓存
                      {item.lastError ? ` · ${item.lastError}` : ""}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button subtle"
                    onClick={() => refreshMut.mutate(item.id)}
                    title="刷新订阅"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button subtle"
                    onClick={() => startEdit(item)}
                    title="编辑订阅"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button subtle danger"
                    onClick={() => deleteMut.mutate(item.id)}
                    title="删除订阅"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <SubscriptionForm
            editing={editing}
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            onSubmit={() =>
              mutation.save(editing?.id, {
                type: draft.type,
                name: draft.name,
                url: draft.url,
                enabled: draft.enabled,
                intervalSeconds: Number(draft.intervalSeconds) || 900,
              })
            }
            onCancel={reset}
          />
        </div>
      </fieldset>
    </FormControlsDisabled.Provider>
  );
}
