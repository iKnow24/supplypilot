import {
  ArrowRight,
  BadgeCheck,
  Check,
  ClipboardList,
  FileDown,
  Gauge,
  Lock,
  Minus,
  PackageSearch,
  Plus,
  Send,
  ShieldCheck,
  Sigma,
  Sparkles,
  Telescope,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/app/logo";
import { Bento } from "@/components/landing/bento";
import { EngineDemo } from "@/components/landing/engine-demo";
import { ProductMockup } from "@/components/landing/product-mockup";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "SupplyPilot · The lowest delivered cost, explained" },
  description:
    "Purchasing for independent restaurants, cafés and bakeries. One list, every supplier, the lowest total delivered cost, and exactly why.",
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

const BEFORE_AFTER = [
  ["Four vendor portals, a phone call and a text thread", "One list for every supplier"],
  ["Item prices compared in your head", "Total delivered cost: fees, minimums, packs"],
  ["You find the minimum at checkout", "Minimums and cutoffs checked before you commit"],
  ["Last month's price sheet", "Out-of-date prices and stock left out, automatically"],
  ["Retype every order, vendor by vendor", "A draft PO per supplier, ready to send"],
] as const;

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

const PROOF = [
  {
    icon: Sigma,
    stat: "Exact",
    label: "Integer optimization, not a guess",
    body: "Every pack, fee, minimum and stock limit goes into one model, solved to the cent. The same order always gets the same answer.",
  },
  {
    icon: Gauge,
    stat: "400",
    label: "Random baskets checked on every test run",
    body: "Each one is cross-checked against brute force, including partial and impossible orders, before any change ships.",
  },
  {
    icon: Lock,
    stat: "Per buyer",
    label: "Row-level security in Postgres",
    body: "Carts, lists, results and orders are walled off per business in the database itself, not just in the app.",
  },
  {
    icon: BadgeCheck,
    stat: "WCAG AA",
    label: "Accessible on every screen",
    body: "Automated accessibility checks, a keyboard-only run of the whole flow and a phone layout test in every CI run.",
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

const ROADMAP = [
  {
    icon: Truck,
    status: "Live",
    title: "Price every order",
    body: "One list, every supplier, the lowest delivered cost with its reasons, and draft POs.",
  },
  {
    icon: PackageSearch,
    status: "In development",
    title: "Know what's running low",
    body: "Stock on hand and weekly usage turn into a suggested order before you run out.",
  },
  {
    icon: Send,
    status: "Planned",
    title: "Send it, with your OK",
    body: "Approved orders go to each vendor the way they already take them: email or text to the rep.",
  },
];

const FAQ = [
  {
    q: "Are these real suppliers and prices?",
    a: "Not yet. The public demo runs on a synthetic catalog: five fictional Orlando suppliers, three fictional kitchens and a fixed demo clock, so every number on this page is exact and repeatable.",
  },
  {
    q: "Does SupplyPilot place orders for me?",
    a: "No. It drafts one purchase order per supplier, which you download as PDF or CSV and send yourself. Nothing reaches a supplier without you.",
  },
  {
    q: "How do you calculate savings?",
    a: "Against the supplier you usually buy each item from. If we can't price your usual supplier for an item, we don't claim a saving on it, and if your usual suppliers are already cheapest, we tell you.",
  },
  {
    q: "What happens when an order can't be filled exactly?",
    a: "You get the best order for everything that can be bought, and each item left out comes with its reason: no one delivers that day, not enough stock, or a minimum that can't be reached.",
  },
  {
    q: "Who is it for?",
    a: "Independent restaurants, cafés and bakeries that buy from several distributors every week and want the lowest total cost without a spreadsheet.",
  },
];

function PrimaryCta({ children = "Open the live demo" }: { children?: string }) {
  return (
    <Link
      href="/home"
      className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_oklch(1_0_0/0.3),0_8px_30px_-6px_oklch(0.8_0.15_163/0.55)] transition-[transform,box-shadow] hover:shadow-[0_0_0_1px_oklch(1_0_0/0.5),0_10px_40px_-6px_oklch(0.8_0.15_163/0.75)] active:translate-y-px"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function SectionHead({
  eyebrow,
  id,
  title,
  children,
  center = false,
}: {
  eyebrow: string;
  id: string;
  title: ReactNode;
  children?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={cn("reveal max-w-2xl", center && "mx-auto text-center")}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-emerald-300 uppercase",
        )}
      >
        <span aria-hidden className="h-px w-6 bg-emerald-300/60" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="text-shine mt-4 text-3xl leading-[1.08] font-semibold tracking-[-0.035em] sm:text-5xl"
      >
        {title}
      </h2>
      {children ? (
        <p className="mt-5 text-base leading-relaxed text-[var(--l-muted)] sm:text-lg">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Small annotation chips around the hero mockup (decorative; md+ only). */
function Callout({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-float absolute z-10 hidden items-center gap-2 rounded-full border border-white/15 bg-[oklch(0.22_0.008_250/0.85)] px-3.5 py-2 text-xs font-medium text-zinc-100 shadow-[0_12px_40px_-8px_oklch(0_0_0/0.6)] backdrop-blur-md xl:flex",
        className,
      )}
    >
      {children}
    </div>
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
                ["#engine", "Product"],
                ["#how", "How it works"],
                ["#honest", "Our promise"],
                ["#faq", "FAQ"],
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
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 font-medium text-emerald-300">
                <span className="relative flex size-1.5">
                  <span className="animate-ping-slow absolute inline-flex size-full rounded-full bg-emerald-300" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
                </span>
                Live
              </span>
              Purchasing for independent kitchens
              <ArrowRight
                className="size-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <h1
              id="hero-title"
              className="text-shine mt-7 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-7xl lg:text-[5.25rem]"
            >
              Stop overpaying for{" "}
              <span className="text-emerald-shine animate-shimmer">every delivery.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--l-muted)] sm:text-lg">
              One list, every supplier. SupplyPilot finds the lowest total delivered cost for your
              restaurant, café or bakery, counting fees, minimums, pack sizes and delivery days,
              then shows you exactly why.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrimaryCta />
              <a
                href="#engine"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 px-6 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/5 hover:text-white"
              >
                See it decide
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-400">
              {["No sign-up", "Fictional suppliers", "Nothing is ever ordered"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-300" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-up relative mx-auto mt-16 max-w-5xl px-4 [animation-delay:350ms] [perspective:2000px] sm:mt-20 sm:px-6">
            <Callout className="-top-5 -left-16">
              <span className="flex size-5 items-center justify-center rounded-full bg-rose-400/20 text-rose-300">
                <Truck className="size-3" />
              </span>
              Pelican&apos;s $45 delivery fee caught
            </Callout>
            <Callout className="-top-5 -right-16 [animation-delay:1.2s]">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Check className="size-3" />
              </span>
              $18.30 less, delivered Wednesday
            </Callout>
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

        {/* ------------------------------------------------------------------ problem */}
        <section aria-labelledby="problem-title" className="mx-auto max-w-6xl px-5 py-24 sm:py-32">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
            <SectionHead eyebrow="The problem" id="problem-title" title="Ordering is a second job.">
              Independent kitchens buy from several distributors every week, each with its own
              prices, pack sizes, fees, minimums and delivery days. The cheapest-looking item is
              often not the cheapest order, and nobody has time to work that out at 10 PM.
            </SectionHead>
            <div className="landing-card reveal overflow-hidden rounded-2xl">
              <div className="grid grid-cols-2 border-b border-white/[0.07] text-xs font-semibold tracking-[0.12em] uppercase">
                <p className="px-4 py-3.5 text-zinc-400 sm:px-5">Today</p>
                <p className="border-l border-white/[0.07] bg-emerald-400/[0.06] px-4 py-3.5 text-emerald-300 sm:px-5">
                  With SupplyPilot
                </p>
              </div>
              <ul className="divide-y divide-white/[0.06]">
                {BEFORE_AFTER.map(([before, after]) => (
                  <li key={before} className="grid grid-cols-2 text-sm">
                    <p className="flex gap-2.5 px-4 py-4 text-[13px] text-zinc-400 sm:px-5 sm:text-sm">
                      <Minus
                        className="mt-0.5 size-4 shrink-0 text-zinc-600 max-sm:hidden"
                        aria-hidden
                      />
                      {before}
                    </p>
                    <p className="flex gap-2.5 border-l border-white/[0.07] bg-emerald-400/[0.03] px-4 py-4 text-[13px] text-zinc-100 sm:px-5 sm:text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-300 max-sm:hidden"
                        aria-hidden
                      />
                      {after}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ engine */}
        <section
          id="engine"
          aria-labelledby="engine-title"
          className="relative isolate scroll-mt-24 border-t border-white/5 py-24 sm:py-32"
        >
          <div
            aria-hidden
            className="absolute top-40 left-1/2 -z-10 h-[420px] w-[1000px] max-w-[160vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.7_0.15_163/0.14),transparent)] blur-2xl"
          />
          <div className="mx-auto max-w-6xl px-5">
            <SectionHead
              eyebrow="See it decide"
              id="engine-title"
              title="The cheapest items aren't the cheapest order."
              center
            >
              Flip the switch and watch the answer change. These are real results from our optimizer
              on the demo catalog.
            </SectionHead>
            <div className="reveal mt-14">
              <EngineDemo />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ features */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="mx-auto max-w-6xl scroll-mt-24 border-t border-white/5 px-5 py-24 sm:py-32"
        >
          <SectionHead
            eyebrow="Built for how buyers really buy"
            id="features-title"
            title="Everything that changes the price, in one answer."
            center
          >
            The real cost of an order lives in fees, minimums and pack sizes. SupplyPilot puts them
            all on the table.
          </SectionHead>
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
            <SectionHead
              eyebrow="How it works"
              id="how-title"
              title="From shopping list to purchase orders in three steps."
            />
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

        {/* ------------------------------------------------------------------ proof */}
        <section
          aria-labelledby="proof-title"
          className="border-t border-white/5 bg-[oklch(0.16_0.006_250)] py-24 sm:py-32"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionHead
              eyebrow="Engineering"
              id="proof-title"
              title="Built to be trusted with the books."
            >
              A purchasing tool that gets the math wrong once doesn&apos;t get a second chance. So
              we test it like infrastructure.
            </SectionHead>
            <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
              {PROOF.map((p) => (
                <li key={p.label} className="reveal bg-[oklch(0.175_0.006_250)] p-6 sm:p-7">
                  <p.icon className="size-5 text-emerald-300" aria-hidden />
                  <p className="text-shine mt-6 text-3xl font-semibold tracking-[-0.03em]">
                    {p.stat}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold text-white">{p.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--l-muted)]">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------------ promise */}
        <section
          id="honest"
          aria-labelledby="honest-title"
          className="scroll-mt-24 border-t border-white/5 py-24 sm:py-32"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <SectionHead eyebrow="Our promise" id="honest-title" title="We don't invent savings.">
              Buying software loves a big &ldquo;you saved&rdquo; number. Ours only appears when
              it&apos;s real, and every plan shows its working.
            </SectionHead>
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

        {/* ------------------------------------------------------------------ roadmap */}
        <section aria-labelledby="roadmap-title" className="border-t border-white/5 py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5">
            <SectionHead
              eyebrow="Where it's going"
              id="roadmap-title"
              title="From price engine to purchasing autopilot."
            >
              Pricing the order is step one. Next, SupplyPilot learns what you use and drafts the
              order before you run out. You still approve every one.
            </SectionHead>
            <ol className="mt-14 grid gap-4 md:grid-cols-3">
              {ROADMAP.map((r, i) => (
                <li
                  key={r.title}
                  className={cn(
                    "reveal relative rounded-2xl p-6",
                    i === 0 ? "glow-border bg-[oklch(0.2_0.012_170)]" : "landing-card",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl border",
                        i === 0
                          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                          : "border-white/10 bg-white/[0.04] text-zinc-300",
                      )}
                    >
                      <r.icon className="size-5" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
                        i === 0
                          ? "bg-emerald-400/15 text-emerald-300"
                          : i === 1
                            ? "bg-amber-300/10 text-amber-200"
                            : "bg-white/[0.06] text-zinc-300",
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--l-muted)]">{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------------ faq */}
        <section
          id="faq"
          aria-labelledby="faq-title"
          className="scroll-mt-24 border-t border-white/5 py-24 sm:py-32"
        >
          <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <SectionHead eyebrow="FAQ" id="faq-title" title="Straight answers." />
            <div className="reveal divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {FAQ.map((f) => (
                <details key={f.q} className="landing-faq group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-medium text-white transition-colors hover:text-emerald-200">
                    {f.q}
                    <Plus
                      className="size-4 shrink-0 text-zinc-400 transition-transform duration-300 group-open:rotate-45"
                      aria-hidden
                    />
                  </summary>
                  <p className="-mt-1 pr-10 pb-5 text-sm leading-relaxed text-[var(--l-muted)]">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
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
              <LogoMark className="mx-auto size-11 rounded-xl" />
              <h2
                id="cta-title"
                className="text-shine mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl"
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
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-semibold text-white">
              <LogoMark className="size-6" />
              SupplyPilot
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
              The lowest delivered cost for independent restaurants, cafés and bakeries, and exactly
              why.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-300 uppercase">
              Product
            </p>
            <ul className="mt-4 space-y-2.5 text-zinc-400">
              <li>
                <Link href="/home" className="transition-colors hover:text-white">
                  Live demo
                </Link>
              </li>
              <li>
                <a href="#engine" className="transition-colors hover:text-white">
                  See it decide
                </a>
              </li>
              <li>
                <a href="#how" className="transition-colors hover:text-white">
                  How it works
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <p className="text-xs font-semibold tracking-[0.14em] text-zinc-300 uppercase">
              Company
            </p>
            <ul className="mt-4 space-y-2.5 text-zinc-400">
              <li>
                <a href="#honest" className="transition-colors hover:text-white">
                  Our promise
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-white">
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/5">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-zinc-400 sm:flex-row sm:justify-between">
            <p>© 2026 SupplyPilot</p>
            <p>
              The public demo uses fictional suppliers, buyers and prices. No real orders are
              placed.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
