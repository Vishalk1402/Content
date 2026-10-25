import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  deleteTemplate,
  getSavedTemplates,
  MAX_TEMPLATES,
  saveTemplate
} from "./templateStorage";

function SavedTemplateCard({ template, selected, onSelect, onDelete }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(template.file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [template.file]);

  return (
    <div className={`saved-template-card${selected ? " selected" : ""}`}>
      <button
        type="button"
        className="saved-template-select"
        onClick={onSelect}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt={`Saved template ${template.slot}`}
          />
        )}
        <span>Template {template.slot}</span>
      </button>

      <button
        type="button"
        className="saved-template-delete"
        onClick={onDelete}
        aria-label={`Delete saved template ${template.slot}`}
      >
        ×
      </button>
    </div>
  );
}

function setTemplateInputFile(file) {
  const input = document.getElementById("template");

  if (!input) {
    throw new Error("Template upload control is not available.");
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function SavedTemplates() {
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [target, setTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const templates = await getSavedTemplates();
        if (!cancelled) setSavedTemplates(templates);
      } catch (error) {
        if (!cancelled) {
          setStorageError(
            error instanceof Error
              ? error.message
              : "Could not load saved templates."
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const input = document.getElementById("template");
    const fieldGroup = input?.closest(".field-group");

    if (!fieldGroup) return undefined;

    const container = document.createElement("div");
    container.className = "saved-templates-mount";
    fieldGroup.appendChild(container);
    setTarget(container);

    return () => {
      setTarget(null);
      container.remove();
    };
  }, []);

  const currentFileKey = useMemo(() => {
    const input = document.getElementById("template");
    const file = input?.files?.[0];

    if (!file) return "";
    return `${file.name}:${file.size}:${file.lastModified}`;
  }, [target, savedTemplates]);

  async function handleSave() {
    const input = document.getElementById("template");
    const file = input?.files?.[0];

    setStorageError("");

    if (!file) {
      setStorageError("Select a template image first.");
      return;
    }

    if (savedTemplates.length >= MAX_TEMPLATES) {
      setStorageError(
        "You can save a maximum of 3 templates. Delete one before saving another."
      );
      return;
    }

    setIsSaving(true);

    try {
      const saved = await saveTemplate(file);
      setSavedTemplates((current) =>
        [...current, saved].sort((a, b) => a.slot - b.slot)
      );
      setSelectedKey(`${file.name}:${file.size}:${file.lastModified}`);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Could not save template."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    setStorageError("");

    try {
      await deleteTemplate(id);
      setSavedTemplates((current) =>
        current.filter((template) => template.id !== id)
      );
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Could not delete template."
      );
    }
  }

  function handleSelect(template) {
    setStorageError("");

    try {
      setTemplateInputFile(template.file);
      setSelectedKey(
        `${template.file.name}:${template.file.size}:${template.file.lastModified}`
      );
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Could not select template."
      );
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="saved-templates">
      <div className="saved-templates-toolbar">
        <div>
          <strong>Saved Templates</strong>
          <span>{savedTemplates.length}/{MAX_TEMPLATES}</span>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={
            isSaving || savedTemplates.length >= MAX_TEMPLATES
          }
        >
          {isSaving ? "Saving..." : "Save Template"}
        </button>
      </div>

      {savedTemplates.length > 0 && (
        <div className="saved-template-grid">
          {savedTemplates.map((template) => {
            const fileKey =
              `${template.file.name}:${template.file.size}:${template.file.lastModified}`;

            return (
              <SavedTemplateCard
                key={template.id}
                template={template}
                selected={
                  selectedKey === fileKey ||
                  currentFileKey === fileKey
                }
                onSelect={() => handleSelect(template)}
                onDelete={() => handleDelete(template.id)}
              />
            );
          })}
        </div>
      )}

      {storageError && (
        <p className="saved-template-error">{storageError}</p>
      )}
    </div>,
    target
  );
}
