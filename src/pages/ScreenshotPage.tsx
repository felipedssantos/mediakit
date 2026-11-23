import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";

import { BoardHeader } from "../components/BoardHeader";
import { BoardWait } from "../components/BoardWait";
import { FieldHint } from "../components/FieldHint";
import { SectionRule } from "../components/SectionRule";
import { OutputDirField } from "../components/settings/OutputDirField";
import { formatErrorMessage } from "../hooks/createJobQueueStore";
import { useScreenshotHistory } from "../hooks/useScreenshotHistory";
import { useScreenshotSettings } from "../hooks/useScreenshotSettings";
import { useToast } from "../hooks/useToast";
import { ptBR } from "../i18n/pt-BR";
import { pickOutputDirectory, revealPath } from "../lib/api/files";
import {
  copyScreenshot,
  saveScreenshot,
  screenshotSrc,
} from "../lib/api/screenshot";
import { printFileName } from "../lib/screenshot";
import type { ScreenshotHistoryItem } from "../types/screenshot";

interface ScreenshotPageProps {
  onBack: () => void;
}

function formatWhen(createdAt: number) {
  return new Date(createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScreenshotPage({ onBack }: ScreenshotPageProps) {
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
      showToast(ptBR.screenshot.toastCopied);
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
    <main className="board-shutter relative flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader
        title={ptBR.screenshot.title}
        detail={ptBR.screenshot.detail}
        onBack={onBack}
      />

      {error && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">
            {ptBR.common.errorStamp}
          </span>
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section className="mb-6">
          <SectionRule step="01" title={ptBR.screenshot.stepHow} />
          <p className="max-w-xl text-sm leading-6 text-paint-dim">
            {ptBR.screenshot.howPart1}{" "}
            <span className="cell text-paint">{ptBR.screenshot.howKey}</span>{" "}
            {ptBR.screenshot.howPart2}
          </p>
          <FieldHint>{ptBR.screenshot.howHint}</FieldHint>
        </section>

        <section className="mb-6">
          <SectionRule step="02" title={ptBR.screenshot.stepDir} />
          <div className="max-w-xl">
            <OutputDirField
              value={outputDir}
              placeholder={ptBR.screenshot.windowsPicturesDir}
              onPick={() => void handlePickFolder()}
            />
            <FieldHint>{ptBR.screenshot.dirHint}</FieldHint>
          </div>
        </section>

        <section>
          <SectionRule step="03" title={ptBR.screenshot.stepHistory} />
          {items.length === 0 ? (
            <p className="text-sm text-paint-dim">
              {ptBR.screenshot.emptyHistory}
            </p>
          ) : (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item.id)}
                      className={`border p-1 text-left ${
                        active
                          ? "border-lamp bg-flap"
                          : "border-rule hover:border-lamp"
                      }`}
                    >
                      <img
                        src={screenshotSrc(item.path)}
                        alt=""
                        className="aspect-video w-full object-cover"
                      />
                      <span className="cell mt-1 block truncate px-0.5 text-[11px] text-paint-faint">
                        {formatWhen(item.created_at)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div className="w-full shrink-0 border border-rule bg-flap p-3 lg:w-88">
                  <img
                    src={screenshotSrc(selected.path)}
                    alt={ptBR.screenshot.selectedAlt}
                    className="mx-auto max-h-64 w-full object-contain"
                  />
                  <p className="cell mt-2 text-xs text-paint-faint">
                    {selected.width}×{selected.height} ·{" "}
                    {formatWhen(selected.created_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy(selected)}
                      className="stamp inline-flex items-center gap-2 border border-steel-dim px-3 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? ptBR.common.copied : ptBR.common.copy}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSave(selected)}
                      className="stamp inline-flex items-center gap-2 border border-lamp bg-lamp px-3 py-1.5 text-void disabled:opacity-50"
                    >
                      {saving ? (
                        <BoardWait compact label={ptBR.common.saving} />
                      ) : null}
                      {saving ? ptBR.common.saving : ptBR.common.save}
                    </button>
                    {savedPath && (
                      <button
                        type="button"
                        onClick={() => void revealPath(savedPath)}
                        className="stamp border border-steel-dim px-3 py-1.5 text-cleared hover:border-lamp"
                      >
                        {ptBR.common.openFolder}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="stamp inline-flex items-center gap-2 border border-steel-dim px-3 py-1.5 text-paint-dim hover:border-fault hover:text-fault"
                    >
                      <Trash2 size={14} />
                      {ptBR.common.delete}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {confirmDelete && selected && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-void/80 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-print-title"
            className="w-full max-w-md border border-rule bg-flap p-4"
          >
            <h2 id="delete-print-title" className="stamp text-paint">
              {ptBR.screenshot.deleteDialogTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-paint-dim">
              {ptBR.screenshot.deleteDialogBody}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="stamp border border-steel-dim px-3 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
              >
                {ptBR.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(selected)}
                className="stamp inline-flex items-center gap-2 border border-fault bg-fault px-3 py-1.5 !text-paint"
              >
                <Trash2 size={14} />
                {ptBR.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
