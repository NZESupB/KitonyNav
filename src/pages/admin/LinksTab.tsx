import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Plus, Trash2 } from "lucide-react";
import { createLink, deleteLink, updateLink } from "../../api";
import { ItemIcon } from "../../components/icons/ItemIcon";
import { FormControlsDisabled, ThemedSelect } from "../../components/ui/ThemedSelect";
import { useSaveMutation } from "../../hooks/use-save-mutation";
import type { BootstrapData, Category, LinkItem } from "../../data";
import { IconFields } from "./IconFields";
import {
  emptyLinkDraft,
  type AdminFeedback,
  type LinkDraft,
} from "./types";

function LinkForm({
  editing,
  draft,
  validCategoryId,
  categories,
  onChange,
  onSubmit,
  onCancel,
}: {
  editing: LinkItem | null;
  draft: LinkDraft;
  validCategoryId: number;
  categories: Category[];
  onChange: (patch: Partial<LinkDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="editor-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">{editing ? "编辑链接" : "新建链接"}</span>
          <h2>{editing ? editing.name : "添加一个链接"}</h2>
        </div>
      </div>
      <label>
        名称
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="例如：Notion"
        />
      </label>
      <label>
        描述
        <input
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="简短的用途描述"
        />
      </label>
      <label>
        地址
        <input
          value={draft.url}
          onChange={(event) => onChange({ url: event.target.value })}
          placeholder="https://"
          inputMode="url"
        />
      </label>
      <label>
        所属分类
        <ThemedSelect
          aria-label="所属分类"
          value={categories.length ? String(validCategoryId) : ""}
          disabled={!categories.length}
          placeholder="请先创建收藏夹"
          onValueChange={(value) => onChange({ categoryId: Number(value) })}
          options={categories.map((category) => ({
            value: String(category.id),
            label: category.name,
          }))}
        />
      </label>
      {categories.length === 0 && (
        <p className="form-empty" role="status">
          尚无收藏夹，请先在分类分区创建。
        </p>
      )}
      <IconFields
        icon={draft.icon}
        iconKind={draft.iconKind}
        iconUrl={draft.iconUrl}
        websiteUrl={draft.url}
        onChange={onChange}
      />
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.connectivityEnabled}
          onChange={(event) => onChange({ connectivityEnabled: event.target.checked })}
        />{" "}
        在主页显示本机连通性
      </label>
      <div className="form-actions">
        <button type="button" className="quiet-button" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onSubmit}
          disabled={
            !draft.name.trim() ||
            !draft.url.trim() ||
            !categories.some((category) => category.id === validCategoryId)
          }
        >
          <Check size={16} /> 保存链接
        </button>
      </div>
    </section>
  );
}

export function LinksTab({
  data,
  onFeedback,
}: {
  data: BootstrapData;
  onFeedback: (feedback: AdminFeedback) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [draft, setDraft] = useState<LinkDraft>(() => ({
    ...emptyLinkDraft,
    categoryId: data.categories[0]?.id ?? 0,
  }));

  const validLinkCategory = data.categories.some((category) => category.id === draft.categoryId)
    ? draft.categoryId
    : (data.categories[0]?.id ?? 0);

  const reset = () => {
    setEditing(null);
    setDraft({
      ...emptyLinkDraft,
      categoryId: data.categories[0]?.id ?? 0,
    });
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const mutation = useSaveMutation(
    createLink,
    updateLink,
    () => {
      onFeedback({ kind: "success", message: "链接已保存" });
      reset();
      void refresh();
    },
    (error) => onFeedback({ kind: "error", message: error.message || "链接保存失败" }),
  );

  const save = () => {
    if (!validLinkCategory) return;
    mutation.save(editing?.id, {
      name: draft.name,
      description: draft.description,
      url: draft.url,
      icon: draft.icon,
      iconKind: draft.iconKind,
      iconUrl: draft.iconUrl,
      categoryId: validLinkCategory,
      featured: editing?.featured ?? false,
      visible: editing?.visible ?? true,
      connectivityEnabled: draft.connectivityEnabled,
    });
  };

  const deleteMut = useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      onFeedback({ kind: "success", message: "链接已删除" });
      refresh();
    },
    onError: (error: Error) => onFeedback({ kind: "error", message: error.message || "删除失败" }),
  });

  const busy = mutation.isPending || deleteMut.isPending;

  const startEdit = (item: LinkItem) => {
    setEditing(item);
    setDraft({
      name: item.name,
      description: item.description,
      url: item.url,
      icon: item.icon,
      iconKind: item.iconKind ?? "builtin",
      iconUrl: item.iconUrl ?? "",
      connectivityEnabled: item.connectivityEnabled !== false,
      categoryId: item.categoryId,
    });
  };

  return (
    <FormControlsDisabled.Provider value={busy}>
      <fieldset className="admin-fields" disabled={busy} aria-busy={busy}>
        <div className="admin-grid">
          <section className="admin-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">链接目录</span>
                <h2>全部链接</h2>
              </div>
              <button type="button" className="primary-button" onClick={reset}>
                <Plus size={16} /> 新增链接
              </button>
            </div>
            <div className="admin-list">
              {data.categories
                .flatMap((category) => category.links.map((item) => ({ item, category })))
                .map(({ item, category }) => (
                  <div className="admin-list-row" key={item.id}>
                    <span className="admin-item-icon">
                      <ItemIcon
                        icon={item.icon}
                        iconKind={item.iconKind}
                        iconUrl={item.iconUrl}
                        websiteUrl={item.url}
                        size={18}
                      />
                    </span>
                    <span className="admin-item-copy">
                      <strong>{item.name}</strong>
                      <small>
                        {category.name} · {item.url}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="icon-button subtle"
                      onClick={() => startEdit(item)}
                      title="编辑链接"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button subtle danger"
                      onClick={() => deleteMut.mutate(item.id)}
                      title="删除链接"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </section>
          <LinkForm
            editing={editing}
            draft={draft}
            validCategoryId={validLinkCategory}
            categories={data.categories}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            onSubmit={save}
            onCancel={reset}
          />
        </div>
      </fieldset>
    </FormControlsDisabled.Provider>
  );
}
