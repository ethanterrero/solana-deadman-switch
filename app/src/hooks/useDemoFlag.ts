import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Reads `?demo=1` from the URL. Used to surface mockup-only chrome
 * (state-preview toggles, simulated states) that should be hidden
 * during a real presentation.
 *
 * On stage you visit the URL without the flag and the toggle is invisible
 * — zero chance of an accidental click during the pitch.
 */
export function useDemoFlag(): boolean {
  const [params] = useSearchParams();
  return useMemo(() => params.get("demo") === "1", [params]);
}

/** Read any custom query param — e.g., `?existing=1` for the wizard pre-check banner preview. */
export function useFlag(name: string): boolean {
  const [params] = useSearchParams();
  return useMemo(() => params.get(name) === "1", [params, name]);
}
