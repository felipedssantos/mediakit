import { FolderOpen, RotateCcw, X } from "lucide-react";

import { useT } from "../hooks/useLocale";
import { revealPath } from "../lib/api/files";
import { getBoardStatus } from "../lib/boardStatus";
import type { JobStatus } from "../types/job";
import { JobRow, RowAction } from "./JobRow";

interface JobCardBaseProps {
  id: string;
  line: number;
  title: string;
  detail: string;
  jobStatus: JobStatus;
  statusLabel?: string;
  progress: number;
  speed: string | null;
  error?: string | null;
  revealTarget: string;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobCardBase({
  id,
  line,
  title,
  detail,
  jobStatus,
  statusLabel,
  progress,
  speed,
  error,
  revealTarget,
  onCancel,
  onRetry,
}: JobCardBaseProps) {
  const t = useT();
  const canCancel =
    jobStatus === "queued" ||
    jobStatus === "running" ||
    jobStatus === "finalizing";
  const canRetry = jobStatus === "failed" || jobStatus === "cancelled";

  return (
    <JobRow
      line={line}
      title={title}
      detail={detail}
      status={getBoardStatus(jobStatus, t)}
      statusLabel={statusLabel}
      progress={progress}
      speed={speed}
      error={error}
      actions={
        <>
          {canCancel && (
            <RowAction danger onClick={() => onCancel(id)}>
              <X size={12} />
              {t.common.cancel}
            </RowAction>
          )}
          {canRetry && (
            <RowAction onClick={() => onRetry(id)}>
              <RotateCcw size={12} />
              {t.common.retry}
            </RowAction>
          )}
          {jobStatus === "completed" && (
            <RowAction onClick={() => void revealPath(revealTarget)}>
              <FolderOpen size={12} />
              {t.common.openFolder}
            </RowAction>
          )}
        </>
      }
    />
  );
}
