import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const STAGGER_MS = 26;
const STEP_MS = 45;
const STEPS = 3;

interface FlapTextProps {
  text: string;
  /** Largura fixa em células. A placa nunca muda de largura, só as abas viram. */
  cells?: number;
  className?: string;
}

/**
 * Texto em células de caractere de largura fixa. Quando o texto muda, cada
 * célula gira algumas vezes antes de assentar, em cascata da esquerda para a
 * direita.
 */
export function FlapText({ text, cells, className = "" }: FlapTextProps) {
  const target = text.toUpperCase();
  const width = cells ?? target.length;
  const padded = target.slice(0, width).padEnd(width, " ");

  const reduceMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(padded);
  const previous = useRef(padded);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (previous.current === padded) return;
    if (reduceMotion) {
      previous.current = padded;
      setShown(padded);
      return;
    }

    const from = previous.current.padEnd(width, " ").slice(0, width);
    previous.current = padded;

    timers.current.forEach(window.clearTimeout);
    timers.current = [];

    const frame = from.split("");
    const changed: number[] = [];
    for (let i = 0; i < width; i += 1) {
      if (frame[i] !== padded[i]) changed.push(i);
    }
    if (changed.length === 0) {
      setShown(padded);
      return;
    }

    changed.forEach((index, order) => {
      for (let step = 0; step < STEPS; step += 1) {
        const id = window.setTimeout(
          () => {
            frame[index] =
              step === STEPS - 1
                ? padded[index]
                : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            setShown(frame.join(""));
          },
          order * STAGGER_MS + step * STEP_MS,
        );
        timers.current.push(id);
      }
    });

    return () => {
      timers.current.forEach(window.clearTimeout);
      timers.current = [];
    };
  }, [padded, width, reduceMotion]);

  return (
    <span className={`cell inline-flex ${className}`}>
      <span className="sr-only">{target.trim()}</span>
      {shown.split("").map((char, index) => (
        <span
          key={index}
          aria-hidden
          className={`flap-face inline-flex h-[1.35em] w-[0.78em] items-center justify-center overflow-hidden ${
            char === " " ? "opacity-40" : ""
          }`}
        >
          <span key={char + String(index)} className="flap-turn leading-none">
            {char === " " ? "\u00a0" : char}
          </span>
        </span>
      ))}
    </span>
  );
}
