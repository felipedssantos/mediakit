/** Espera do painel: células de aba que acendem em cascata, não um spinner. */
export function BoardWait({
  compact = false,
  label = "Carregando",
}: {
  compact?: boolean;
  label?: string;
}) {
  const count = compact ? 3 : 5;
  return (
    <span className="board-wait" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className="board-wait-cell"
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </span>
  );
}
