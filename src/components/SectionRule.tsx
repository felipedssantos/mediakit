export function SectionRule({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-2 flex h-5 shrink-0 items-center gap-2.5">
      <span className="cell shrink-0 text-xs text-paint-faint">{step}</span>
      <h2 className="stamp truncate text-paint-dim">{title}</h2>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-rule" />
    </div>
  );
}
