import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { VaultGlyph } from "../components/VaultGlyph";
import { useReducedMotion } from "../hooks/useReducedMotion";

const MANIFESTO = [
  { prefix: "> ", text: "No custodian." },
  { prefix: "> ", text: "No keeper bot." },
  { prefix: "> ", text: "No backdoor." },
  { prefix: "> ", text: "Only code. Only time." },
];

export function ColdOpen() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const targetRef = useRef<HTMLDivElement>(null);
  const [ctaReady, setCtaReady] = useState(false);

  // Typewriter
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    // Clear first — guards against StrictMode's double-invoke (and HMR) stacking
    // a second copy of the manifesto onto the first run's appended nodes.
    target.innerHTML = "";

    if (reduced) {
      // Render all lines immediately
      target.innerHTML = MANIFESTO.map(
        (l) =>
          `<div class="text-base text-muted leading-relaxed min-h-[1.5em]">
             <span class="text-green">${l.prefix}</span><span class="text-text">${l.text}</span>
           </div>`,
      ).join("");
      setCtaReady(true);
      return;
    }

    let cancelled = false;
    const run = async () => {
      await new Promise((r) => setTimeout(r, 1700));
      for (const line of MANIFESTO) {
        if (cancelled) return;
        await typeLine(target, line);
        await new Promise((r) => setTimeout(r, 180));
      }
      if (!cancelled) setCtaReady(true);
    };
    run();
    return () => {
      cancelled = true;
      // Drop any partially-typed nodes so the remount starts clean.
      target.innerHTML = "";
    };
  }, [reduced]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        navigate("/identify");
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        const target = targetRef.current;
        if (!target) return;
        target.innerHTML = MANIFESTO.map(
          (l) =>
            `<div class="text-base text-muted leading-relaxed min-h-[1.5em]">
               <span class="text-green">${l.prefix}</span><span class="text-text">${l.text}</span>
             </div>`,
        ).join("");
        setCtaReady(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <Shell>
      {/* Top hat */}
      <header className="absolute top-0 left-0 right-0 px-10 py-6 flex justify-between items-center z-10 animate-fade-in opacity-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green glow-green animate-blink" />
          <Stamp>DEADMAN_SWITCH · v0.1 · DEVNET</Stamp>
        </div>
        <Stamp>SOLANA :: PROGRAM 6gbT...fFu</Stamp>
      </header>

      <main className="min-h-screen flex flex-col items-center justify-center px-6 relative py-24">
        <div className="mb-10 animate-fade-in opacity-0" style={{ animationDelay: "400ms" }}>
          <VaultGlyph size={168} still={reduced} />
        </div>

        <div
          className="stamp text-green glow-green mb-5 animate-fade-in opacity-0"
          style={{ animationDelay: "400ms" }}
        >
          A TRUSTLESS INHERITANCE PROTOCOL · ON SOLANA
        </div>

        <div
          className="relative mb-7 text-center animate-fade-in opacity-0"
          style={{ animationDelay: "900ms" }}
        >
          <h1 className="font-extrabold leading-[0.88] tracking-tight m-0 text-text relative z-10 text-shadow"
            style={{
              fontSize: "clamp(2.6rem, 9.5vw, 9rem)",
              letterSpacing: "-0.045em",
              fontWeight: 900,
              textShadow: "0 0 32px rgba(255,255,255,.08)",
            }}
          >
            DEAD MAN'S
            <br />
            SWITCH<span className="text-green animate-blink">_</span>
          </h1>
          {/* chromatic green echo — full width + centered so it sits under the
              white title; the 4px offset is applied via transform, not left/top,
              so it stays horizontally centered instead of shrink-wrapping left. */}
          <h1
            aria-hidden
            className="absolute inset-x-0 top-0 z-0 text-green opacity-30 text-center"
            style={{
              fontSize: "clamp(2.6rem, 9.5vw, 9rem)",
              fontWeight: 900,
              letterSpacing: "-0.045em",
              lineHeight: "0.88",
              margin: 0,
              filter: "blur(.5px)",
              transform: "translate(3px, 4px)",
            }}
          >
            DEAD MAN'S
            <br />
            SWITCH
          </h1>
        </div>

        <div
          className="stamp text-amber glow-amber text-sm md:text-base mb-12 text-center animate-fade-in opacity-0"
          style={{ animationDelay: "1400ms" }}
        >
          ◇&nbsp;&nbsp;TIME IS THE ONLY ENFORCER&nbsp;&nbsp;◇
        </div>

        <div ref={targetRef} className="mb-14 text-left space-y-1.5 min-h-[140px]" />

        {/* CTA — revealed once manifesto finishes */}
        <button
          onClick={() => navigate("/identify")}
          aria-hidden={!ctaReady}
          tabIndex={ctaReady ? 0 : -1}
          className="font-mono font-bold uppercase tracking-[0.22em] text-base px-12 py-5 border-2 border-green text-green bg-transparent hover:bg-green hover:text-black transition-all duration-300 relative cursor-pointer min-h-[44px]"
          style={{
            opacity: ctaReady ? 1 : 0,
            transition: "opacity 700ms ease, letter-spacing 240ms ease, background 240ms ease, color 240ms ease, box-shadow 240ms ease",
          }}
        >
          <span className="absolute top-[-8px] left-[-8px] w-3 h-3 border-t-2 border-l-2 border-green" />
          <span className="absolute bottom-[-8px] right-[-8px] w-3 h-3 border-b-2 border-r-2 border-green" />
          INITIATE ▶▶
        </button>

        <div
          className="stamp mt-8 opacity-0 animate-fade-in"
          style={{ animationDelay: "4800ms" }}
        >
          press [ space ] to skip intro · [ enter ] to advance
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 700ms cubic-bezier(.2,.7,.2,1) forwards; }
      `}</style>
    </Shell>
  );
}

function typeLine(
  target: HTMLDivElement,
  line: { prefix: string; text: string },
): Promise<void> {
  return new Promise((resolve) => {
    const div = document.createElement("div");
    div.className = "text-base text-muted leading-relaxed min-h-[1.5em]";
    div.innerHTML = `<span class="text-green">${line.prefix}</span><span class="text-text"></span><span class="inline-block w-2 h-4 align-middle bg-green animate-blink ml-0.5"></span>`;
    target.appendChild(div);
    const textEl = div.querySelector(".text-text") as HTMLSpanElement;
    let i = 0;
    const id = setInterval(() => {
      textEl.textContent = line.text.slice(0, i);
      i++;
      if (i > line.text.length) {
        clearInterval(id);
        const cursor = div.querySelector("span:last-child");
        cursor?.remove();
        resolve();
      }
    }, 22);
  });
}
