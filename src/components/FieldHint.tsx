import type { ReactNode } from "react";

interface FieldHintProps {
  children: ReactNode;
}

export function FieldHint({ children }: FieldHintProps) {
  return <p className="mt-1.5 text-xs leading-5 text-ink-3">{children}</p>;
}
