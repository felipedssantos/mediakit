import { AlertCircle } from "lucide-react";

interface ErrorBannerProps {
  message: string | null | undefined;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="shrink-0 border-b border-danger/20 bg-danger-soft px-6 py-2.5 text-xs font-medium text-danger">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}
