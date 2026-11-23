import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ErrorBanner } from "../components/ErrorBanner";
import { FieldHint } from "../components/FieldHint";
import { StepHeader } from "../components/StepHeader";
import { OutputDirField } from "../components/settings/OutputDirField";
import { formatErrorMessage } from "../hooks/createJobQueueStore";
import { useLocale, useT } from "../hooks/useLocale";
import { useScreenshotHistory } from "../hooks/useScreenshotHistory";
import { useScreenshotSettings } from "../hooks/useScreenshotSettings";
import { useToast } from "../hooks/useToast";
import { pickOutputDirectory, revealPath } from "../lib/api/files";
import {
  copyScreenshot,
  saveScreenshot,
  screenshotSrc,
} from "../lib/api/screenshot";
import { printFileName } from "../lib/screenshot";
import type { ScreenshotHistoryItem } from "../types/screenshot";

function formatWhen(createdAt: number, locale: string) {
  return new Date(createdAt).toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScreenshotPage() {
  const t = useT();
  const locale = useLocale((state) => state.locale);
  const items = useScreenshotHistory((state) => state.items);
  const hydrate = useScreenshotHistory((state) => state.hydrate);
  const remove = useScreenshotHistory((state) => state.remove);
  const outputDir = useScreenshotSettings((state) => state.outputDir);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);
  const setOutputDir = useScreenshotSettings((state) => state.setOutputDir);
  const showToast = useToast((state) => state.show);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    void hydrate().catch((err) => setError(formatErrorMessage(err)));
    void hydrateSettings();
  }, [hydrate, hydrateSettings]);

  function handleSelectItem(id: string) {
    setSelectedId(id);
    setCopied(false);
    setSavedPath(null);
    setError(null);
    setConfirmDelete(false);
  }

  async function handleCopy(item: ScreenshotHistoryItem) {
    setError(null);
    try {
      await copyScreenshot(item.path);
      setCopied(true);
      showToast(t.screenshot.toastCopied);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }

  async function handleSave(item: ScreenshotHistoryItem) {
    let destDir = outputDir;
    if (!destDir) {
      const directory = await pickOutputDirectory();
      if (!directory) return;
      destDir = directory;
      setOutputDir(directory);
    }
    setSaving(true);
    setError(null);
    try {
      const path = await saveScreenshot(item.path, destDir, printFileName());
      setSavedPath(path);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ScreenshotHistoryItem) {
    setError(null);
    try {
      await remove(item.id);
      setCopied(false);
      setSavedPath(null);
      setConfirmDelete(false);
      if (selectedId === item.id) setSelectedId(null);
    } catch (err) {
      setError(formatErrorMessage(err));
    }
  }

  async function handlePickFolder() {
    const directory = await pickOutputDirectory();
    if (directory) setOutputDir(directory);
  }

  return (
    <main className="ui-enter relative flex h-full min-h-0 flex-col bg-canvas text-ink">
      <header className="shrink-0 border-b border-line bg-surface px-6 py-4">
        <h1 className="text-xl font-bold tracking-tight text-ink">
          {t.screenshot.title}
        </h1>
        <p className="mt-0.5 text-sm text-ink-2">{t.screenshot.detail}</p>
      </header>

      <ErrorBanner message={error} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <section className="surface-card rounded-2xl p-4">
            <StepHeader step="1" title={t.screenshot.stepHow} />
            <p className="max-w-2xl text-sm leading-6 text-ink-2">
              {t.screenshot.howPart1}{" "}
              <kbd className="mono-num rounded-md border border-line-strong bg-elevated px-2 py-0.5 text-xs font-semibold text-ink">
                {t.screenshot.howKey}
              </kbd>{" "}
              {t.screenshot.howPart2}
            </p>
            <FieldHint>{t.screenshot.howHint}</FieldHint>
          </section>

          <section className="surface-card rounded-2xl p-4">
            <StepHeader step="2" title={t.screenshot.stepDir} />
            <div className="max-w-xl">
              <OutputDirField
                value={outputDir}
                placeholder={t.screenshot.windowsPicturesDir}
                onPick={() => void handlePickFolder()}
              />
              <FieldHint>{t.screenshot.dirHint}</FieldHint>
            </div>
          </section>

          <section>
            <StepHeader step="3" title={t.screenshot.stepHistory} />
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-inset p-8 text-center text-sm text-ink-3">
                {t.screenshot.emptyHistory}
              </div>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => {
                    const active = selected?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item.id)}
                        className={`ui-card overflow-hidden rounded-xl border p-1.5 text-left ${
                          active
                            ? "border-accent bg-accent-soft ring-1 ring-accent/30"
                            : "surface-card hover:border-line-strong"
                        }`}
                      >
                        <img
                          src={screenshotSrc(item.path)}
                          alt=""
                          className="aspect-video w-full rounded-lg object-cover"
                        />
                        <span className="mono-num mt-1.5 block truncate px-1 text-[11px] text-ink-2">
                          {formatWhen(item.created_at, locale)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selected && (
                  <div className="surface-card w-full shrink-0 rounded-2xl p-4 lg:w-88">
                    <img
                      src={screenshotSrc(selected.path)}
                      alt={t.screenshot.selectedAlt}
                      className="mx-auto max-h-64 w-full rounded-lg bg-inset object-contain"
                    />
                    <p className="mono-num mt-2.5 text-xs text-ink-2">
                      {selected.width}×{selected.height} ·{" "}
                      {formatWhen(selected.created_at, locale)}
                    </p>
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopy(selected)}
                        className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? t.common.copied : t.common.copy}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSave(selected)}
                        className="ui-btn inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
                      >
                        {saving && (
                          <Loader2 size={13} className="animate-spin" />
                        )}
                        {saving ? t.common.saving : t.common.save}
                      </button>
                      {savedPath && (
                        <button
                          type="button"
                          onClick={() => void revealPath(savedPath)}
                          className="ui-btn rounded-lg border border-ok/30 bg-ok-soft px-3 py-1.5 text-xs font-medium text-ok"
                        >
                          {t.common.openFolder}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-danger/25 bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger hover:border-danger"
                      >
                        <Trash2 size={14} />
                        {t.common.delete}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {confirmDelete && selected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-canvas/80 px-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-print-title"
            className="surface-card w-full max-w-md rounded-2xl p-5 shadow-xl"
          >
            <h2
              id="delete-print-title"
              className="text-base font-bold text-ink"
            >
              {t.screenshot.deleteDialogTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">
              {t.screenshot.deleteDialogBody}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="ui-btn rounded-lg border border-line-strong bg-elevated px-3.5 py-2 text-xs font-medium text-ink"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(selected)}
                className="ui-btn inline-flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-accent-ink"
              >
                <Trash2 size={14} />
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
