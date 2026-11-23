import { animate, stagger, type JSAnimation } from "animejs";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Staggered entrance animation powered by Anime.js. Returns a cleanup function. */
export function animateStaggerIn(
  targets: Element | Element[] | NodeListOf<Element> | null | undefined,
  options?: {
    y?: number;
    scale?: number;
    duration?: number;
    staggerMs?: number;
  },
): () => void {
  if (!targets || prefersReducedMotion()) return () => {};
  const list =
    targets instanceof Element ? [targets] : Array.from(targets);
  if (list.length === 0) return () => {};

  const anim: JSAnimation = animate(list, {
    opacity: [0, 1],
    translateY: [options?.y ?? 14, 0],
    scale: [options?.scale ?? 0.98, 1],
    duration: options?.duration ?? 460,
    delay: stagger(options?.staggerMs ?? 45),
    ease: "outExpo",
  });

  return () => {
    anim.cancel();
  };
}

/** Smooth page container entrance on screen switch. */
export function animatePageEnter(target: Element | null | undefined): () => void {
  if (!target || prefersReducedMotion()) return () => {};
  const anim = animate(target, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 320,
    ease: "outCubic",
  });
  return () => {
    anim.cancel();
  };
}

/** Tactile spring-like pop on selection or toggle confirmation. */
export function animatePop(target: Element | null | undefined): void {
  if (!target || prefersReducedMotion()) return;
  animate(target, {
    scale: [0.95, 1.02, 1],
    duration: 340,
    ease: "outBack",
  });
}

/** Smoothly rotates a theme icon when toggling Light/Dark mode. */
export function animateThemeIcon(target: Element | null | undefined): void {
  if (!target || prefersReducedMotion()) return;
  animate(target, {
    rotate: [-90, 0],
    scale: [0.7, 1],
    opacity: [0.4, 1],
    duration: 360,
    ease: "outBack",
  });
}

/** Slides the sidebar active indicator pill to the active nav button. */
export function animateIndicatorTo(
  indicator: HTMLElement | null | undefined,
  top: number,
  height: number,
  immediate = false,
): void {
  if (!indicator) return;
  if (immediate || prefersReducedMotion()) {
    indicator.style.transform = `translateY(${top}px)`;
    indicator.style.height = `${height}px`;
    indicator.style.opacity = "1";
    return;
  }
  animate(indicator, {
    translateY: top,
    height,
    opacity: 1,
    duration: 280,
    ease: "outExpo",
  });
}

/** Loops subtle pulse nodes along diagram tracks inside tool cards. */
export function animateDiagramPulses(
  container: Element | null | undefined,
): () => void {
  if (!container || prefersReducedMotion()) return () => {};
  const pulses = Array.from(container.querySelectorAll("[data-diagram-pulse]"));
  if (pulses.length === 0) return () => {};

  const anim = animate(pulses, {
    translateX: [0, 36],
    opacity: [0, 1, 1, 0],
    duration: 2200,
    delay: stagger(320),
    loop: true,
    ease: "inOutSine",
  });

  return () => {
    anim.cancel();
  };
}
