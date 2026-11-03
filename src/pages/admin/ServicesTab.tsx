import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Plus, Trash2 } from "lucide-react";
import { createService, deleteService, updateService } from "../../api";
import { FormControlsDisabled } from "../../components/ui/ThemedSelect";
import { useSaveMutation } from "../../hooks/use-save-mutation";
import type { BootstrapData, ServiceStatus } from "../../data";
import {
  emptyServiceDraft,
  type AdminFeedback,
  type ServiceDraft,
} from "./types";

function ServiceForm({
  editing,
  draft,
  onChange,
  onSubmit,
  onCancel,
}: {
  editing: ServiceStatus | null;
  draft: ServiceDraft;
  onChange: (patch: Partial<ServiceDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="editor-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">{editing ? "编辑服务" : "新建服务"}</span>
          <h2>{editing ? editing.name : "添加关注服务"}</h2>
        </div>
      </div>
      <label>
        名称
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="例如：GitHub"
        />
      </label>
      <label>
        检测地址
        <input
          value={draft.target}
          onChange={(event) => onChange({ target: event.target.value })}
          placeholder="https://status.example.com"
          inputMode="url"
        />
        <small className="form-help">由访问者浏览器定时测速，不经过服务器</small>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />{" "}
        在主页关注此服务
      </label>
      <div className="form-actions">
        <button type="button" className="quiet-button" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={!draft.name.trim()}
        >
          <Check size={16} /> 保存服务
        </button>
      </div>
    </section>
  );
}

export function ServicesTab({
  data,
  onFeedback,
}: {
  data: BootstrapData;
  onFeedback: (feedback: AdminFeedback) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ServiceStatus | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(emptyServiceDraft);

  const reset = () => {
    setEditing(null);
    setDraft(emptyServiceDraft);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const mutation = useSaveMutation(
    createService,
    updateService,
    () => {
      onFeedback({ kind: "success", message: "服务已保存" });
      reset();
      void refresh();
    },
    (error) => onFeedback({ kind: "error", message: error.message || "服务保存失败" }),
  );

  const deleteMut = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      onFeedback({ kind: "success", message: "服务已删除" });
      refresh();
    },
    onError: (error: Error) => onFeedback({ kind: "error", message: error.message || "删除失败" }),
  });

  const busy = mutation.isPending || deleteMut.isPending;

  const startEdit = (item: ServiceStatus) => {
    setEditing(item);
    setDraft({
      name: item.name,
      enabled: item.enabled !== false,
      target: item.target ?? "",
    });
  };

  return (
    <FormControlsDisabled.Provider value={busy}>
      <fieldset className="admin-fields" disabled={busy} aria-busy={busy}>
        <div className="admin-grid">
          <section className="admin-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">关注清单</span>
                <h2>服务状态</h2>
              </div>
              <button type="button" className="primary-button" onClick={reset}>
                <Plus size={16} /> 新增服务
              </button>
            </div>
            <div className="admin-list">
              {data.services.map((item) => (
                <div className="admin-list-row" key={item.id}>
                  {/* 设置页只反映配置状态，不代表健康；健康状态由主页浏览器测速给出 */}
                  <span className={`status-dot ${item.target ? "configured" : "unknown"}`} title={item.target ? "已配置检测地址" : "未配置检测地址"} />
                  <span className="admin-item-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {item.target || "未配置检测地址"}
                      {item.enabled === false ? " · 未在主页关注" : ""}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button subtle"
                    onClick={() => startEdit(item)}
                    title="编辑服务"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button subtle danger"
                    onClick={() => deleteMut.mutate(item.id)}
                    title="删除服务"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <ServiceForm
            editing={editing}
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            onSubmit={() => mutation.save(editing?.id, draft)}
            onCancel={reset}
          />
        </div>
      </fieldset>
    </FormControlsDisabled.Provider>
  );
}
