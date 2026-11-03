import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Edit3, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, updateCategory } from "../../api";
import { ItemIcon } from "../../components/icons/ItemIcon";
import { FormControlsDisabled } from "../../components/ui/ThemedSelect";
import { useSaveMutation } from "../../hooks/use-save-mutation";
import type { BootstrapData, Category } from "../../data";
import { IconFields } from "./IconFields";
import {
  emptyCategoryDraft,
  type AdminFeedback,
  type CategoryDraft,
} from "./types";

function CategoryForm({
  editing,
  draft,
  onChange,
  onSubmit,
  onCancel,
}: {
  editing: Category | null;
  draft: CategoryDraft;
  onChange: (patch: Partial<CategoryDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="editor-panel">
      <div className="section-title">
        <div>
          <span className="eyebrow">{editing ? "编辑收藏夹" : "新建收藏夹"}</span>
          <h2>{editing ? editing.name : "添加一个收藏夹"}</h2>
        </div>
      </div>
      <label>
        名称
        <input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="例如：设计资源"
        />
      </label>
      <label>
        描述
        <input
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="一句话说明这个收藏夹"
        />
      </label>
      <IconFields
        icon={draft.icon}
        iconKind={draft.iconKind}
        iconUrl={draft.iconUrl}
        onChange={onChange}
      />
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
          <Check size={16} /> 保存收藏夹
        </button>
      </div>
    </section>
  );
}

export function CategoriesTab({
  data,
  onFeedback,
}: {
  data: BootstrapData;
  onFeedback: (feedback: AdminFeedback) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(emptyCategoryDraft);

  const reset = () => {
    setEditing(null);
    setDraft(emptyCategoryDraft);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["bootstrap"] });

  const mutation = useSaveMutation(
    createCategory,
    updateCategory,
    () => {
      onFeedback({ kind: "success", message: "分类已保存" });
      reset();
      void refresh();
    },
    (error) => onFeedback({ kind: "error", message: error.message || "分类保存失败" }),
  );

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      onFeedback({ kind: "success", message: "分类已删除" });
      refresh();
    },
    onError: (error: Error) => onFeedback({ kind: "error", message: error.message || "删除失败" }),
  });

  const busy = mutation.isPending || deleteMut.isPending;

  const startEdit = (category: Category) => {
    setEditing(category);
    setDraft({
      name: category.name,
      description: category.description,
      icon: category.icon,
      iconKind: category.iconKind ?? "builtin",
      iconUrl: category.iconUrl ?? "",
    });
  };

  return (
    <FormControlsDisabled.Provider value={busy}>
      <fieldset className="admin-fields" disabled={busy} aria-busy={busy}>
        <div className="admin-grid">
          <section className="admin-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">目录结构</span>
                <h2>收藏夹</h2>
              </div>
              <button type="button" className="primary-button" onClick={reset}>
                <Plus size={16} /> 新增收藏夹
              </button>
            </div>
            <div className="admin-list">
              {data.categories.map((category) => (
                <div className="admin-list-row" key={category.id}>
                  <span className="admin-item-icon">
                    <ItemIcon
                      icon={category.icon}
                      iconKind={category.iconKind}
                      iconUrl={category.iconUrl}
                      size={18}
                    />
                  </span>
                  <span className="admin-item-copy">
                    <strong>{category.name}</strong>
                    <small>
                      {category.description} · {category.links.length} 个链接
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-button subtle"
                    onClick={() => startEdit(category)}
                    title="编辑收藏夹"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button subtle danger"
                    onClick={() => deleteMut.mutate(category.id)}
                    title="删除收藏夹"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <CategoryForm
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
