import { UI_MOCK } from "@/lib/mock/enabled";
import { NetworkCanvas } from "./network-canvas";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — AssetGrid" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#05070c] text-[#eaf1f8]">
      <NetworkCanvas />
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(3,5,9,.55) 78%, rgba(3,5,9,.9) 100%)",
        }}
      />

      <div className="fixed inset-x-0 top-0 z-[3] flex items-center justify-between px-6 py-4 font-mono text-[10.5px] tracking-[0.14em] text-white/40 uppercase">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-[7px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#31d17a] opacity-70" />
            <span className="relative inline-flex size-[7px] rounded-full bg-[#31d17a] shadow-[0_0_12px_rgba(49,209,122,0.8)]" />
          </span>
          Network Operational
        </div>
      </div>

      <div className="relative z-[2] grid min-h-screen place-items-center p-6">
        <div
          className="w-full max-w-[404px] rounded-[18px] border border-white/10 bg-[rgba(16,22,34,0.62)] px-8 pt-9 pb-7 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
          style={{ backdropFilter: "blur(18px) saturate(1.2)" }}
        >
          <div className="relative">
            <div
              className="absolute -top-9 right-0 left-0 h-px"
              style={{ background: "linear-gradient(90deg,transparent,#2fa1ee,transparent)", opacity: 0.7 }}
            />
          </div>

          <p className="text-center text-lg font-semibold tracking-tight text-white [text-shadow:0_0_18px_rgba(47,161,238,0.45)]">
            AssetGrid
          </p>
          <p className="mt-5 mb-6 grid gap-1 text-center font-mono text-[10px] tracking-[0.28em] text-[#2fa1ee] uppercase">
            <span>Operations Console</span>
            <span className="text-white/30">Operator Access</span>
          </p>

          <LoginForm next={typeof next === "string" ? next : undefined} mock={UI_MOCK} />
        </div>
      </div>

      <p className="fixed inset-x-0 bottom-4 z-[3] text-center font-mono text-[10px] tracking-[0.24em] text-white/30 uppercase">
        Fleet monitoring, built for the connected world
      </p>
    </div>
  );
}
