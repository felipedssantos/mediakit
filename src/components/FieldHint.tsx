import type { ReactNode } from "react";

interface FieldHintProps {
  children: ReactNode;
}

/** Texto explicativo sempre visível abaixo de um controle, pensado para quem não é técnico. */
export function FieldHint({ children }: FieldHintProps) {
  return (
    <p className="mt-1.5 text-xs leading-5 text-paint-faint">{children}</p>
  );
}
