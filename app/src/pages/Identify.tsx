import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shell } from "../components/Shell";
import { Stamp } from "../components/Stamp";
import { BackLink } from "../components/BackLink";
import { WalletPill } from "../components/WalletPill";

export function Identify() {
  const navigate = useNavigate();
  const { connected } = useWallet();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") navigate("/arm");
      else if (e.key === "2") navigate("/watch");
      else if (e.key === "Escape") navigate("/");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <Shell>
      <header className="px-10 py-6 flex justify-between items-center animate-fade-in opacity-0">
        <BackLink to="/" />
        <div className="flex items-center gap-2.5">
          <WalletPill />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {!connected && (
          <div className="mb-8 p-6 bg-panel border border-amber/40 border-l-2 border-l-amber">
            <Stamp tone="amber">⚠ wallet not connected</Stamp>
            <p className="text-sm text-muted mt-2 leading-relaxed">
              connect a wallet to proceed. you can still browse the wizard, but tx broadcast requires a signer.
            </p>
          </div>
        )}

        <Stamp className="mb-6 block">STEP 02 OF 04 · IDENTITY SELECT</Stamp>

        <div className="mb-10">
          <h1
            className="font-extrabold text-text leading-tight m-0"
            style={{ fontSize: "clamp(1.4rem, 3.4vw, 2.4rem)", letterSpacing: "-0.02em" }}
          >
            <span className="text-green">&gt;</span> IDENTIFY YOURSELF.<span className="text-green animate-blink">_</span>
          </h1>
          <p className="text-muted mt-3 text-sm md:text-base">
            the same wallet can play either role. pick the one for this session.
          </p>
        </div>

        <div className="tile-grid grid md:grid-cols-2 gap-8 mb-12">
          <RoleTile
            to="/arm"
            role="A"
            title="OWNER"
            description={
              <>
                i want to lock SOL behind my own continued check-in.
                <br />
                if i go silent, the funds release to a beneficiary i choose.
              </>
            }
            bullets={[
              "Initialize a new vault",
              "Check in on your schedule",
              "Deposit more, cancel anytime",
            ]}
            keyHint="[1] press to select"
            slide="left"
          />
          <RoleTile
            to="/watch"
            role="B"
            title="BENEFICIARY"
            description={
              <>
                someone locked SOL with me as the heir.
                <br />
                i'm here to watch their countdown — and claim when it hits zero.
              </>
            }
            bullets={[
              "Look up a vault by owner address",
              "See the live countdown until claimable",
              "Claim the funds when time elapses",
            ]}
            keyHint="[2] press to select"
            slide="right"
          />
        </div>

        <div className="text-center mt-6">
          <Stamp>
            same wallet for both roles · [ 1 ] OWNER · [ 2 ] BENEFICIARY · [ ESC ] BACK
          </Stamp>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 700ms cubic-bezier(.2,.7,.2,1) forwards; }
        .tile-grid:has(.role-tile:hover) .role-tile:not(:hover) {
          opacity: 0.32; filter: saturate(0.4);
        }
        @media (prefers-reduced-motion: reduce) {
          .tile-grid:has(.role-tile:hover) .role-tile:not(:hover) {
            opacity: 1 !important; filter: none !important;
          }
        }
      `}</style>
    </Shell>
  );
}

function RoleTile({
  to,
  role,
  title,
  description,
  bullets,
  keyHint,
  slide,
}: {
  to: string;
  role: string;
  title: string;
  description: React.ReactNode;
  bullets: string[];
  keyHint: string;
  slide: "left" | "right";
}) {
  return (
    <Link
      to={to}
      // NOTE: keep both animate-slide-l and animate-slide-r as complete literal
      // class strings below — Tailwind's JIT can't see dynamically-built class
      // names (`animate-${...}`), so constructing them leaves the tile stuck at
      // its inline opacity:0.
      className={`role-tile relative bg-panel border border-border p-9 no-underline text-text flex flex-col gap-6 min-h-[420px] cursor-pointer transition-all duration-300 hover:border-green/35 hover:bg-[#0d100e] hover:shadow-[0_0_0_1px_rgba(0,255,136,.25),0_0_80px_rgba(0,255,136,.18),inset_0_0_60px_rgba(0,255,136,.06)] hover:-translate-y-[3px] group ${
        slide === "left" ? "animate-slide-l" : "animate-slide-r"
      }`}
      style={{
        opacity: 0,
        transform: `translateX(${slide === "left" ? "-40px" : "40px"})`,
        animationDelay: slide === "left" ? "300ms" : "450ms",
        animationFillMode: "forwards",
      }}
    >
      {/* Corner brackets */}
      <span aria-hidden className="absolute top-[-1px] left-[-1px] w-3.5 h-3.5 border-t-2 border-l-2 border-green opacity-60 group-hover:opacity-100 transition-opacity" />
      <span aria-hidden className="absolute top-[-1px] right-[-1px] w-3.5 h-3.5 border-t-2 border-r-2 border-green opacity-60 group-hover:opacity-100 transition-opacity" />
      <span aria-hidden className="absolute bottom-[-1px] left-[-1px] w-3.5 h-3.5 border-b-2 border-l-2 border-green opacity-60 group-hover:opacity-100 transition-opacity" />
      <span aria-hidden className="absolute bottom-[-1px] right-[-1px] w-3.5 h-3.5 border-b-2 border-r-2 border-green opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between">
        <div className="w-16 h-16 flex items-center justify-center border border-border bg-panel-2 group-hover:border-green group-hover:shadow-[0_0_24px_rgba(0,255,136,.35),inset_0_0_12px_rgba(0,255,136,.15)] transition-all duration-300">
          <span className="text-green text-2xl">{role === "A" ? "◉" : "👁"}</span>
        </div>
        <Stamp>ROLE / {role}</Stamp>
      </div>

      <div>
        <div className="stamp mb-3">&gt; MODE</div>
        <h2
          className="font-black text-text leading-none m-0 group-hover:text-green group-hover:[text-shadow:0_0_24px_rgba(0,255,136,.4)] transition-all"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em" }}
        >
          {title}
        </h2>
      </div>

      <p className="text-[0.95rem] leading-relaxed text-muted group-hover:text-[#c8c8c8] transition-colors">
        {description}
      </p>

      <ul className="text-xs text-muted-deep space-y-1.5 leading-relaxed">
        {bullets.map((b) => (
          <li key={b}>
            <span className="text-green">▸</span> {b}
          </li>
        ))}
      </ul>

      <div className="flex justify-between items-center pt-6 mt-auto border-t border-border group-hover:border-green/30 transition-colors text-xs">
        <span className="text-muted-deep">{keyHint}</span>
        <span className="text-text font-bold tracking-widest uppercase inline-flex items-center gap-2 group-hover:text-green group-hover:gap-3 transition-all">
          SELECT <span>▶▶</span>
        </span>
      </div>
    </Link>
  );
}
