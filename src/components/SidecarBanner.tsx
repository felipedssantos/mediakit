import { AlertTriangle, RefreshCw, Settings, Wrench, X } from "lucide-react";

import { useT } from "../hooks/useLocale";
import { useSidecars } from "../hooks/useSidecars";
import { useToast } from "../hooks/useToast";

interface SidecarBannerProps {
  onOpenSettings: () => void;
}

export function SidecarBanner({ onOpenSettings }: SidecarBannerProps) {
  const t = useT();
  const showToast = useToast((state) => state.show);
  const report = useSidecars((state) => state.report);
  const repairing = useSidecars((state) => state.repairing);
  const progress = useSidecars((state) => state.progress);
  const error = useSidecars((state) => state.error);
  const bannerDismissed = useSidecars((state) => state.bannerDismissed);
  const repair = useSidecars((state) => state.repair);
  const dismissBanner = useSidecars((state) => state.dismissBanner);

  if (!report || report.all_ok || bannerDismissed) {
    return null;
  }

  const missingItems = report.items.filter((item) => !item.ok);
  const hasCustomError = missingItems.some((item) => item.source === "custom");
  const missingNames = missingItems.map((item) => item.name).join(", ");

  const bannerTitle = hasCustomError
    ? "Executável externo incorreto ou incompatível"
    : t.sidecars.bannerTitle;

  const bannerBody = hasCustomError
    ? `O arquivo selecionado para ${missingNames} não é válido. Clique em 'Configurar caminho' para corrigir ou restaurar o padrão.`
    : t.sidecars.bannerBody(missingNames);

  async function handleRepair() {
    const next = await repair();
    if (next?.all_ok) {
      showToast(t.sidecars.repairSuccess);
    }
  }

  return (
    <div
      role="alert"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-ink"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-amber-400"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{bannerTitle}</p>
            <p className="mt-0.5 text-ink-2">{bannerBody}</p>
            {repairing && progress && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] font-medium text-ink-2">
                  {progress.message}
                </span>
                {typeof progress.percent === "number" && (
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-inset">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {error && !repairing && (
              <p className="mt-1 text-[11px] text-rose-400">{error}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={repairing}
            onClick={() => void handleRepair()}
            className="ui-control inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {repairing ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Wrench size={13} />
            )}
            {repairing ? t.sidecars.repairingButton : t.sidecars.repairButton}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="ui-control inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          >
            <Settings size={13} />
            {t.sidecars.configureButton}
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label={t.sidecars.dismissLabel}
            className="ui-control rounded-lg p-1 text-ink-2 hover:bg-surface hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
