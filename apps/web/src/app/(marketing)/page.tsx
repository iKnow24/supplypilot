import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  FileDown,
  ShieldCheck,
  Sparkles,
  Telescope,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { LogoMark } from "@/components/app/logo";
import { Bento } from "@/components/landing/bento";
import { ProductMockup } from "@/components/landing/product-mockup";

export const metadata: Metadata = {
  title: { absolute: "SupplyPilot · The lowest delivered cost, explained" },
};

const FACTORS = [
  "Delivery fees",
  "Order minimums",
  "Free-delivery thresholds",
  "Pack sizes",
  "Contract prices",
  "Volume tiers",
  "Delivery days",
  "Order cutoffs",
  "Stock on hand",
  "Price freshness",
];

const STEPS = [
  {
    icon: ClipboardList,
    title: "Build one list",
    body: "Load last week's order, search the catalog, or drop in a CSV. Pick the day you need it.",
  },
  {
    icon: Sparkles,
    title: "Find My Best Price",
    body: "Every supplier and every rule, solved exactly in seconds. Alternatives come with the trade-off spelled out.",
  },
  {
    icon: FileDown,
    title: "Approve, download, send",
    body: "One draft PO per supplier, ready as PDF or CSV. You send it; we never order anything for you.",
  },
];

const PRINCIPLES = [
  {
    icon: BadgeCheck,
    title: "Savings you can check",
    body: "Measured against what you usually pay your usual suppliers. If they're already cheapest, we say so.",
  },
  {
    icon: Telescope,
    title: "Partial, never padded",
    body: "If an item can't be bought sensibly, it's left out with the reason. We never pad an order to hit a minimum.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    body: "Nothing goes to a supplier without you. Every plan is stored exactly as it was calculated.",
  },
];

function PrimaryCta({ children = "Open the live demo" }: { children?: string }) {
  return (
    <Link
      href="/home"
      className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_oklch(1_0_0/0.3),0_8px_30px_-6px_oklch(0.8_0.15_163/0.55)] transition-[transform,box-shadow] hover:shadow-[0_0_0_1px_oklch(1_0_0/0.5),0_10px_40px_-6px_oklch(0.8_0.15_163/0.75)] active:translate-y-px"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export default async function LandingPage() {
  // Render per request so Next can stamp its scripts with this request's CSP nonce.
  await connection();
  return (
    <div className="landing min-h-dvh overflow-x-clip">
      {/* ------------------------------------------------------------------ nav */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-3 flex h-14 max-w-6xl items-center gap-6 rounded-full border border-white/10 bg-[oklch(0.17_0.006_250/0.7)] px-3 pl-5 backdrop-blur-xl max-sm:mx-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"
            aria-label="SupplyPilot home"
          >
            <LogoMark />
            <span>SupplyPilot</span>
          </Link>
          <nav aria-label="Sections" className="hidden md:block">
            <ul className="flex gap-1 text-sm text-[var(--l-muted)]">
              {[
                ["#features", "Features"],
                ["#how", "How it works"],
                ["#honest", "Our promise"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/home"
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Live demo <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* ------------------------------------------------------------------ hero */}
        <section aria-labelledby="hero-title" className="relative isolate pt-36 sm:pt-44">
          <div aria-hidden className="landing-grid absolute inset-0 -z-10" />
          <div
            aria-hidden
            className="animate-glow absolute top-24 left-1/2 -z-10 h-[520px] w-[900px] max-w-[140vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.7_0.15_163/0.32),transparent)] blur-2xl"
          />
          <div className="stagger mx-auto max-w-4xl px-5 text-center">
            <Link
              href="/home"
              className="group mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1 text-xs text-zinc-300 transition-colors hover:border-white/20"
            >
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-medium text-emerald-300">
                Live
              </span>
              Try it with three fictional Orlando kitchens
              <ArrowRight
                className="size-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <h1
              id="hero-title"
              className="text-shine mt-7 text-5xl leading-[1.02] font-semibold tracking-[-0.04em] sm:text-7xl"
            >
              Stop overpaying for{" "}
              <span className="text-emerald-shine animate-shimmer">every delivery.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--l-muted)] sm:text-lg">
              One shopping list, every supplier. SupplyPilot finds the lowest total delivered cost
              for your restaurant, café or bakery, counting fees, minimums and delivery days, then
              shows you exactly why.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <a
                href="#how"
                className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                See how it works
              </a>
            </div>
            <p className="mt-5 text-xs text-zinc-400">
              No sign-up. Fictional suppliers. Nothing is ever ordered.
            </p>
          </div>

          <div className="animate-fade-up relative mx-auto mt-16 max-w-5xl px-4 [animation-delay:350ms] [perspective:2000px] sm:mt-20 sm:px-6">
            <div className="origin-top transition-transform duration-700 md:[transform:rotateX(8deg)] md:hover:[transform:rotateX(0deg)]">
              <ProductMockup />
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--l-bg)] to-transparent"
            />
          </div>
        </section>

        {/* ------------------------------------------------------------------ factors */}
        <section aria-labelledby="factors-title" className="border-y border-white/5 py-10">
          <h2
            id="factors-title"
            className="text-center text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase"
          >
            Every order is priced on
          </h2>
          <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)]">
            <div className="animate-marquee flex w-max gap-3 hover:[animation-play-state:paused]">
              {[0, 1].map((copy) => (
                <ul
                  key={copy}
                  aria-hidden={copy === 1 ? true : undefined}
                  className="flex shrink-0 gap-3"
                >
                  {FACTORS.map((f) => (
                    <li
                      key={f}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-sm whitespace-nowrap text-zinc-300"
                    >
                      {f}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ features */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:py-32"
        >
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-emerald-300">Built for how buyers really buy</p>
            <h2
              id="features-title"
              className="text-shine mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
            >
              Everything that changes the price, in one answer.
            </h2>
            <p className="mt-4 text-[var(--l-muted)]">
              The real cost of an order lives in fees, minimums and pack sizes. SupplyPilot puts
              them all on the table.
            </p>
          </div>
          <div className="mt-14">
            <Bento />
          </div>
        </section>

        {/* ------------------------------------------------------------------ how it works */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="relative scroll-mt-24 border-t border-white/5 py-24 sm:py-32"
        >
          <div className="mx-auto max-w-6xl px-5">
            <div className="reveal max-w-2xl">
              <p className="text-sm font-medium text-emerald-300">How it works</p>
              <h2
                id="how-title"
                className="text-shine mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
              >
                From shopping list to purchase orders in three steps.
              </h2>
            </div>
            <div className="relative mt-14">
              <div
                aria-hidden
                className="absolute top-11 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent md:block"
              />
              <ol className="relative grid gap-4 md:grid-cols-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="landing-card reveal relative rounded-2xl p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                        <s.icon className="size-5" aria-hidden />
                      </span>
                      <span className="tabular text-xs font-medium text-zinc-400">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--l-muted)]">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ promise */}
        <section
          id="honest"
          aria-labelledby="honest-title"
          className="scroll-mt-24 border-t border-white/5 py-24 sm:py-32"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <div className="reveal">
              <p className="text-sm font-medium text-emerald-300">Our promise</p>
              <h2
                id="honest-title"
                className="text-shine mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
              >
                We don&apos;t invent savings.
              </h2>
              <p className="mt-4 leading-relaxed text-[var(--l-muted)]">
                Buying software loves a big &ldquo;you saved&rdquo; number. Ours only appears when
                it&apos;s real, and every plan shows its working.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="landing-card reveal flex gap-4 rounded-2xl p-5">
                  <p.icon className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden />
                  <div>
                    <h3 className="font-semibold tracking-tight text-white">{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--l-muted)]">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------------ final CTA */}
        <section aria-labelledby="cta-title" className="px-5 pb-24 sm:pb-32">
          <div className="glow-border reveal relative mx-auto max-w-5xl overflow-hidden rounded-3xl">
            <div className="relative isolate bg-[oklch(0.18_0.01_200)] px-6 py-16 text-center sm:py-24">
              <div
                aria-hidden
                className="absolute top-0 left-1/2 -z-10 h-80 w-[700px] max-w-[160%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.75_0.15_163/0.45),transparent)] blur-2xl"
              />
              <div aria-hidden className="landing-grid absolute inset-0 -z-10 opacity-60" />
              <h2
                id="cta-title"
                className="text-shine mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl"
              >
                See your next order priced properly.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[var(--l-muted)]">
                Open the demo as a bakery, café or restaurant. Load a list, pick a day, and press
                one button.
              </p>
              <div className="mt-9 flex justify-center">
                <PrimaryCta>Try the live demo</PrimaryCta>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------------ footer */}
      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 font-semibold text-white">
            <LogoMark className="size-6" />
            SupplyPilot
          </div>
          <p className="max-w-md text-xs leading-relaxed">
            The public demo uses fictional suppliers, buyers and prices. No real orders are placed.
          </p>
          <p className="text-xs">© 2026 SupplyPilot</p>
        </div>
      </footer>
    </div>
  );
}
