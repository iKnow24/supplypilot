import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardList,
  FileDown,
  Gauge,
  Lock,
  Package,
  Plus,
  Receipt,
  ShieldCheck,
  Sigma,
  Sparkles,
  Tag,
  Telescope,
  TimerReset,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { Logo, LogoMark, Wordmark } from "@/components/app/logo";
import { EngineDemo } from "@/components/landing/engine-demo";
import { Photo } from "@/components/landing/photo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "SupplyPilot · Buy your kitchen's ingredients for less" },
  description:
    "For independent bakeries, cafés and restaurants. One list, every supplier, the lowest total delivered cost, and exactly why.",
  // A page-level openGraph replaces the root one, including the file-based share image,
  // so name the image again here.
  openGraph: {
    title: "SupplyPilot · Stop overpaying for every delivery",
    description: "One list, every supplier, the lowest total delivered cost, and exactly why.",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "SupplyPilot: stop overpaying for every delivery. One list, every supplier, the lowest total delivered cost.",
      },
    ],
  },
};

/* ------------------------------------------------------------------ content */

const KITCHENS = [
  { photo: "bakery-bread", label: "Bakeries" },
  { photo: "cafe-milk", label: "Cafés" },
  { photo: "restaurant-cook", label: "Restaurants" },
  { photo: "produce-crate", label: "Produce" },
  { photo: "eggs", label: "Dairy & eggs" },
  { photo: "flour-butter", label: "Baking staples" },
  { photo: "po-box", label: "Packaging" },
];

/** Real optimizer results on the demo catalog (fictional suppliers, fixed demo clock). */
const DEALS = [
  {
    photo: "milk",
    title: "The weekly milk run",
    who: "Third Shift Coffee · Wed, Nov 11",
    total: "$132.60",
    tag: "Save $18.30",
    vs: "vs $150.90 at the supplier with the cheapest item prices",
    why: "Pelican's $45 delivery fee wipes out its lower prices. Meadowlark wins, delivered.",
  },
  {
    photo: "cafe-milk",
    title: "Cups, lids & napkins",
    who: "Third Shift Coffee · paper goods",
    total: "$489.30",
    tag: "Save $52.30",
    vs: "vs $541.60 for the same order on Saturday",
    why: "Only Pelican delivers Saturday. Move it to Wednesday and Kestrel can, for less.",
  },
  {
    photo: "produce-crate",
    title: "Onions & tomatoes",
    who: "Little Juniper · Mon, Nov 9",
    total: "$113.70",
    tag: "Minimum checked",
    vs: "Kestrel looked cheaper, at about $88.30",
    why: "Kestrel has a $400 minimum. You find out now, not at checkout.",
  },
];

const FACTORS = [
  {
    icon: Truck,
    title: "Delivery fees & free-delivery thresholds",
    body: "A $45 fee can erase a week of cheaper prices. Every fee is counted, and waived when you pass a threshold.",
  },
  {
    icon: Receipt,
    title: "Order minimums",
    body: "Suppliers whose minimum you can't reach are ruled out up front, with the reason in plain English.",
  },
  {
    icon: CalendarClock,
    title: "Delivery days & cutoffs",
    body: "Pick the day you need it. See who can deliver, and the time you have to order by.",
  },
  {
    icon: Package,
    title: "Pack sizes",
    body: "Ask in pounds, quarts or each. We round up to real cases and show exactly how much extra you get.",
  },
  {
    icon: Tag,
    title: "Your contract prices",
    body: "The lowest of your contract price, the list price and any volume tier, line by line.",
  },
  {
    icon: TimerReset,
    title: "Fresh data only",
    body: "Prices and stock counts past their freshness limit are left out, and the plan tells you so.",
  },
];

const STEPS = [
  {
    photo: "flour-butter",
    icon: ClipboardList,
    title: "Build one list",
    body: "Load last week's order, search the catalog, or drop in a spreadsheet. Pick the day you need it.",
  },
  {
    photo: "market-stall",
    icon: Sparkles,
    title: "Find My Best Price",
    body: "Every supplier and every rule, solved exactly in seconds, with the trade-offs spelled out.",
  },
  {
    photo: "po-box",
    icon: FileDown,
    title: "Approve and send",
    body: "One draft purchase order per supplier, as PDF or CSV. You send it; nothing goes out without you.",
  },
];

/** Sunday Crumb Bakery's real rows from the demo Stock page (fixed demo clock). */
const STOCK_ROWS = [
  {
    item: "All-purpose flour",
    onHand: "4.3 lb",
    use: "288 lb/wk",
    runsOut: "Today",
    order: "572 lb",
    bars: ["h-3", "h-4", "h-3.5", "h-4", "h-4.5", "h-4", "h-5", "h-5.5"],
  },
  {
    item: "Unsalted butter",
    onHand: "15.3 lb",
    use: "70 lb/wk",
    runsOut: "Tomorrow",
    order: "126 lb",
    bars: ["h-4", "h-4", "h-4.5", "h-4", "h-4.5", "h-4", "h-5", "h-4.5"],
  },
  {
    item: "Pastry boxes",
    onHand: "32",
    use: "197/wk",
    runsOut: "Tomorrow",
    order: "362",
    bars: ["h-3", "h-3.5", "h-3", "h-4", "h-4", "h-4.5", "h-5", "h-5.5"],
  },
  {
    item: "Whole milk",
    onHand: "4.1 gal",
    use: "7.6 gal/wk",
    runsOut: "In 3 days",
    order: "11 gal",
    bars: ["h-4", "h-3.5", "h-4", "h-4", "h-4.5", "h-4", "h-4.5", "h-5"],
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

const PROOF = [
  { icon: Sigma, stat: "Exact", label: "Integer optimization, solved to the cent" },
  { icon: Gauge, stat: "400", label: "Random orders checked against brute force every test run" },
  { icon: Lock, stat: "Private", label: "Each business walled off in the database itself" },
  { icon: BadgeCheck, stat: "WCAG AA", label: "Accessibility checks on every screen" },
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
    q: "How does it know what I'm running low on?",
    a: "From your last shelf count and how fast you've used each item over the past four weeks. It sizes each order to last until the delivery arrives, then seven more days, plus a two-day buffer.",
  },
  {
    q: "Who is it for?",
    a: "Independent bakeries, cafés and restaurants that buy from several distributors every week and want the lowest total cost without a spreadsheet.",
  },
];

/* ------------------------------------------------------------------ pieces */

function Cta({
  href = "/home",
  children,
  variant = "primary",
  className,
}: {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "light";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-all active:translate-y-px",
        variant === "primary" &&
          "bg-navy hover:bg-navy-deep text-white shadow-[0_10px_24px_-10px_oklch(0.3_0.065_262/0.7)]",
        variant === "light" && "text-navy-deep hover:bg-cream bg-white",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-navy text-[13px] font-bold tracking-[0.16em] uppercase", className)}>
      {children}
    </p>
  );
}

function H2({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2
      id={id}
      className={cn(
        "font-display text-ink mt-3 text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-[3.5rem]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ page */

export default async function LandingPage() {
  // Render per request so Next can stamp its scripts with this request's CSP nonce.
  await connection();
  return (
    <div className="market min-h-dvh overflow-x-clip">
      {/* ------------------------------------------------------------ promo bar */}
      <div className="bg-navy-deep text-cream">
        <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-5 py-2.5 text-center text-[13px] font-medium">
          <span className="bg-butter text-ink rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase">
            New
          </span>
          <span>SupplyPilot now tracks what&apos;s running low and drafts your weekly order.</span>
          <a href="#stock" className="hidden underline underline-offset-2 sm:inline">
            See how
          </a>
        </p>
      </div>

      {/* ------------------------------------------------------------ header */}
      <header className="border-ink/10 bg-cream/90 sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5">
          <Logo className="text-ink text-[23px]" />
          <nav aria-label="Sections" className="hidden lg:block">
            <ul className="text-ink-soft flex gap-1 text-[15px] font-semibold">
              {[
                ["#savings", "Savings"],
                ["#how", "How it works"],
                ["#stock", "Stock"],
                ["#honest", "Our promise"],
                ["#faq", "FAQ"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="hover:text-ink rounded-full px-3 py-2 transition-colors hover:bg-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/home"
            className="bg-navy hover:bg-navy-deep ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-white transition-colors"
          >
            Try the live demo <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        {/* ------------------------------------------------------------ hero */}
        <section aria-labelledby="hero-title" className="relative isolate">
          <div
            aria-hidden
            className="bg-sand absolute inset-y-0 right-0 -z-10 hidden w-[42%] rounded-bl-[5rem] lg:block"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pt-14 pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
            <div className="stagger">
              <Eyebrow>For independent bakeries, cafés &amp; restaurants</Eyebrow>
              <h1
                id="hero-title"
                className="font-display text-ink mt-5 text-[3.1rem] leading-[0.98] font-semibold sm:text-7xl lg:text-[5.4rem]"
              >
                Stop overpaying for <span className="scribble text-navy">every delivery.</span>
              </h1>
              <p className="text-ink-soft mt-7 max-w-xl text-lg leading-relaxed sm:text-xl">
                Put this week&apos;s order on one list. SupplyPilot checks every supplier&apos;s
                prices, delivery fees, minimums and delivery days, and tells you exactly where to
                buy each item for the lowest total.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Cta>Open the live demo</Cta>
                <a
                  href="#savings"
                  className="border-ink/15 text-ink hover:border-ink/30 inline-flex h-12 items-center justify-center rounded-full border-2 bg-white px-7 text-[15px] font-semibold transition-colors"
                >
                  See real savings
                </a>
              </div>
              <ul className="text-ink-soft mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                {["No sign-up", "Fictional suppliers", "Nothing is ever ordered"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <span className="bg-mist text-navy flex size-5 items-center justify-center rounded-full">
                      <Check className="size-3" aria-hidden />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* collage */}
            <div className="animate-fade-up relative mx-auto w-full max-w-xl [animation-delay:200ms] lg:max-w-none">
              <Photo
                src="hero-bakery"
                eager
                alt="Bakers behind a counter full of fresh bread and pastries"
                className="aspect-[4/4.4] w-full rounded-[2.25rem] shadow-[0_30px_60px_-30px_oklch(0.3_0.04_70/0.6)] sm:ml-auto sm:w-[86%]"
              />
              <div className="absolute -bottom-8 left-0 w-[44%] -rotate-3 rounded-2xl bg-white p-2 pb-3 shadow-[0_20px_40px_-18px_oklch(0.3_0.04_70/0.55)] max-sm:hidden">
                <Photo src="bakery-bread" eager className="aspect-[4/3] w-full rounded-xl" />
                <p className="text-ink mt-2 px-1 text-xs font-bold">Sunday Crumb Bakery</p>
                <p className="text-ink-soft px-1 text-[11px]">14 items · 3 usual suppliers</p>
              </div>

              {/* the receipt */}
              <div
                aria-hidden
                className="paper animate-float absolute top-8 right-2 w-60 rounded-2xl p-4 max-sm:hidden sm:-right-6 sm:w-64"
              >
                <div className="flex items-center justify-between">
                  <p className="text-ink text-sm font-bold">Wednesday&apos;s order</p>
                  <span className="bg-mist text-navy-deep rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                    Best price
                  </span>
                </div>
                <p className="text-ink-soft mt-0.5 text-[11px]">Third Shift Coffee · Meadowlark</p>
                <div className="text-ink mt-3 space-y-1.5 text-xs">
                  {[
                    ["Whole milk × 4 cases", "$75.60"],
                    ["Oat milk × 1 case", "$42.00"],
                    ["Delivery", "$15.00"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="tabular">{v}</span>
                    </div>
                  ))}
                  <div className="border-ink/15 flex items-baseline justify-between border-t border-dashed pt-2">
                    <span className="font-bold">Total delivered</span>
                    <span className="tabular font-display text-xl font-semibold">$132.60</span>
                  </div>
                </div>
                <p className="price-tag mt-3 inline-block py-1 pr-3 text-xs font-bold">
                  $18.30 less than the cheapest-looking supplier
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ kitchens */}
        <section aria-labelledby="kitchens-title" className="border-ink/10 border-y bg-white py-14">
          <div className="mx-auto max-w-7xl px-5">
            <h2
              id="kitchens-title"
              className="font-display text-ink text-center text-2xl font-semibold sm:text-3xl"
            >
              Everything your kitchen orders, from every supplier, on one list.
            </h2>
            <ul className="mt-10 grid grid-cols-4 gap-x-4 gap-y-8 sm:grid-cols-7">
              {KITCHENS.map((k) => (
                <li key={k.label} className="group flex flex-col items-center text-center">
                  <span className="ring-sand group-hover:ring-butter rounded-full ring-4 transition-all">
                    <Photo
                      src={k.photo}
                      className="size-16 rounded-full transition-transform group-hover:scale-105 sm:size-24"
                    />
                  </span>
                  <span className="text-ink mt-3 text-sm font-semibold">{k.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ savings */}
        <section
          id="savings"
          aria-labelledby="savings-title"
          className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:py-28"
        >
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <Eyebrow>This week&apos;s best buys</Eyebrow>
              <H2 id="savings-title">The cheapest items aren&apos;t the cheapest order.</H2>
            </div>
            <p className="text-ink-soft max-w-md text-lg leading-relaxed">
              Real results from the SupplyPilot demo. What you pay is the delivered total, so
              that&apos;s what we compare.
            </p>
          </div>

          <ul className="mt-14 grid gap-6 md:grid-cols-3">
            {DEALS.map((d) => (
              <li key={d.title} className="paper reveal flex flex-col overflow-hidden rounded-3xl">
                <div className="relative">
                  <Photo src={d.photo} className="aspect-[16/10] w-full" />
                  <span className="text-ink absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase">
                    Demo
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-ink-soft text-xs font-semibold">{d.who}</p>
                  <h3 className="font-display text-ink mt-1 text-2xl font-semibold">{d.title}</h3>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="tabular font-display text-ink text-4xl font-semibold">
                      {d.total}
                    </p>
                    <p
                      className={cn(
                        "py-1 pr-3 text-sm font-bold",
                        d.tag.startsWith("Save")
                          ? "price-tag"
                          : "bg-butter text-ink rounded-lg pl-3",
                      )}
                    >
                      {d.tag}
                    </p>
                  </div>
                  <p className="text-ink-soft mt-1 text-sm">{d.vs}</p>
                  <p className="border-ink/10 text-ink mt-5 border-t pt-4 text-sm leading-relaxed">
                    {d.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div id="engine" className="mt-20 scroll-mt-24">
            <div className="mb-8 text-center">
              <h3 className="font-display text-ink text-3xl font-semibold sm:text-4xl">
                See it decide
              </h3>
              <p className="text-ink-soft mx-auto mt-3 max-w-xl">
                Pick an order, flip the switch, and watch the answer change.
              </p>
            </div>
            <EngineDemo />
          </div>
        </section>

        {/* ------------------------------------------------------------ factors */}
        <section
          id="features"
          aria-labelledby="features-title"
          className="bg-navy-deep text-cream scroll-mt-20 py-24 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
            <div>
              <Eyebrow className="text-butter">What we count</Eyebrow>
              <H2 id="features-title" className="text-white">
                Everything that changes the price, in one answer.
              </H2>
              <p className="text-cream/85 mt-5 text-lg leading-relaxed">
                The real cost of an order hides in fees, minimums and pack sizes. SupplyPilot puts
                all of it on the table, for every supplier, every time.
              </p>
              <Photo
                src="market-stall"
                className="mt-10 hidden aspect-[4/3] w-full rounded-3xl lg:block"
              />
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {FACTORS.map((f) => (
                <li
                  key={f.title}
                  className="reveal rounded-3xl border border-white/10 bg-white/[0.06] p-6"
                >
                  <span className="bg-butter text-ink flex size-11 items-center justify-center rounded-2xl">
                    <f.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
                  <p className="text-cream/85 mt-2 text-[15px] leading-relaxed">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ how it works */}
        <section
          id="how"
          aria-labelledby="how-title"
          className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:py-28"
        >
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>How it works</Eyebrow>
            <H2 id="how-title">From shopping list to purchase orders in three steps.</H2>
          </div>
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="paper reveal overflow-hidden rounded-3xl">
                <div className="relative">
                  <Photo src={s.photo} className="aspect-[16/10] w-full" />
                  <span className="font-display bg-butter text-ink absolute -bottom-6 left-6 flex size-12 items-center justify-center rounded-2xl text-2xl font-semibold shadow-md">
                    {i + 1}
                  </span>
                </div>
                <div className="p-6 pt-10">
                  <h3 className="text-ink flex items-center gap-2 text-xl font-bold">
                    <s.icon className="text-navy size-5" aria-hidden />
                    {s.title}
                  </h3>
                  <p className="text-ink-soft mt-2 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------------ stock */}
        <section
          id="stock"
          aria-labelledby="stock-title"
          className="bg-sand scroll-mt-20 py-24 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <span className="bg-tomato rounded-full px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
                New
              </span>
              <H2 id="stock-title" className="mt-5">
                Know what&apos;s running low before you run out.
              </H2>
              <p className="text-ink-soft mt-5 text-lg leading-relaxed">
                Count the shelf in seconds. SupplyPilot learns how fast you use each item and drafts
                this week&apos;s order for you, sized to last until the next delivery.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Weekly use from your last four weeks, with the trend",
                  "The day each item runs out, so nothing surprises you",
                  "An order that lasts until delivery, plus 7 days and a 2-day buffer",
                  "One tap sends it to Find My Best Price",
                ].map((t) => (
                  <li key={t} className="text-ink flex gap-3 font-medium">
                    <span className="bg-navy mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white">
                      <Check className="size-3.5" aria-hidden />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <Photo
                src="bakery-counter"
                className="absolute -top-8 -right-6 hidden aspect-[4/3] w-2/3 rounded-3xl lg:block"
              />
              <div aria-hidden className="paper relative rounded-3xl p-5 sm:p-6 lg:mt-24 lg:-ml-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-ink-soft text-xs font-semibold">
                      Sunday Crumb Bakery · Stock
                    </p>
                    <p className="text-ink mt-0.5 font-bold">
                      We drafted 13 items for Tuesday, Nov 10
                    </p>
                  </div>
                  <span className="bg-navy rounded-full px-3 py-1.5 text-xs font-bold text-white">
                    Price this order →
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["9", "Run out first", "text-tomato"],
                    ["13", "To order", "text-ink"],
                    ["1", "Enough", "text-navy"],
                  ].map(([n, l, c]) => (
                    <div key={l} className="bg-cream rounded-xl py-2.5">
                      <p className={cn("font-display text-2xl font-semibold", c)}>{n}</p>
                      <p className="text-ink-soft text-[11px] font-semibold">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="text-ink divide-ink/10 mt-4 divide-y text-xs">
                  <div className="text-ink-soft grid grid-cols-[1.4fr_0.8fr_1.2fr_0.8fr] gap-2 pb-2 text-[10px] font-bold tracking-wide uppercase sm:grid-cols-[1.4fr_0.8fr_1.3fr_0.9fr_0.8fr]">
                    <span>Item</span>
                    <span>On hand</span>
                    <span>Weekly use</span>
                    <span className="max-sm:hidden">Runs out</span>
                    <span className="text-right">Order</span>
                  </div>
                  {STOCK_ROWS.map((r) => (
                    <div
                      key={r.item}
                      className="grid grid-cols-[1.4fr_0.8fr_1.2fr_0.8fr] items-center gap-2 py-2.5 sm:grid-cols-[1.4fr_0.8fr_1.3fr_0.9fr_0.8fr]"
                    >
                      <span className="font-semibold">{r.item}</span>
                      <span className="tabular">{r.onHand}</span>
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 items-end gap-0.5 max-sm:hidden">
                          {r.bars.map((h, i) => (
                            <span
                              key={i}
                              className={cn(
                                "w-1 rounded-sm",
                                h,
                                i === r.bars.length - 1 ? "bg-navy" : "bg-kraft",
                              )}
                            />
                          ))}
                        </span>
                        <span className="tabular">{r.use}</span>
                      </span>
                      <span
                        className={cn(
                          "font-semibold max-sm:hidden",
                          r.runsOut === "Today" || r.runsOut === "Tomorrow"
                            ? "text-tomato"
                            : "text-ink",
                        )}
                      >
                        {r.runsOut}
                      </span>
                      <span className="tabular text-right font-bold">{r.order}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ savings check */}
        <section aria-labelledby="check-title" className="mx-auto max-w-7xl px-5 py-24 sm:py-28">
          <div className="bg-navy relative isolate grid overflow-hidden rounded-[2.5rem] lg:grid-cols-2">
            <div className="p-8 sm:p-12 lg:p-16">
              <Eyebrow className="text-butter">Free savings check</Eyebrow>
              <h2
                id="check-title"
                className="font-display mt-3 text-4xl leading-[1.05] font-semibold text-white sm:text-5xl"
              >
                How much would you save?
              </h2>
              <p className="text-cream/90 mt-5 text-lg leading-relaxed">
                Send us three recent invoices and we&apos;ll show you what the same orders would
                have cost through SupplyPilot. Invoice checks are coming soon. Until then, try it
                with one of our demo kitchens.
              </p>
              <Cta variant="light" className="mt-8">
                Try a demo kitchen
              </Cta>
            </div>
            <div className="relative min-h-72">
              <Photo
                src="bakery-bread"
                alt="Fresh loaves with handwritten price labels"
                className="absolute inset-0 h-full w-full"
              />
              <div
                aria-hidden
                className="paper absolute right-6 bottom-6 left-6 rounded-2xl p-4 sm:left-auto sm:w-72"
              >
                <p className="text-ink flex items-center gap-2 text-sm font-bold">
                  <Receipt className="text-navy size-4" /> 3 invoices in
                </p>
                <p className="text-ink-soft mt-1 text-xs">Bramblewood · Meadowlark · Citrus Row</p>
                <p className="text-ink mt-3 text-xs font-semibold">
                  Every line compared against every supplier, delivered.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ promise */}
        <section
          id="honest"
          aria-labelledby="honest-title"
          className="border-ink/10 scroll-mt-20 border-t bg-white py-24 sm:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <div>
              <Eyebrow>Our promise</Eyebrow>
              <H2 id="honest-title">We don&apos;t invent savings.</H2>
              <p className="text-ink-soft mt-5 text-lg leading-relaxed">
                Buying software loves a big &ldquo;you saved&rdquo; number. Ours only shows up when
                it&apos;s real, and every plan shows its working.
              </p>
              <ul className="mt-10 grid grid-cols-2 gap-3">
                {PROOF.map((p) => (
                  <li key={p.label} className="bg-cream rounded-2xl p-4">
                    <p.icon className="text-navy size-5" aria-hidden />
                    <p className="font-display text-ink mt-3 text-2xl font-semibold">{p.stat}</p>
                    <p className="text-ink-soft mt-1 text-sm leading-snug">{p.label}</p>
                  </li>
                ))}
              </ul>
            </div>
            <ul className="space-y-4">
              {PRINCIPLES.map((p) => (
                <li key={p.title} className="paper reveal flex gap-5 rounded-3xl p-6 sm:p-7">
                  <span className="bg-mist text-navy flex size-12 shrink-0 items-center justify-center rounded-2xl">
                    <p.icon className="size-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="text-ink text-xl font-bold">{p.title}</h3>
                    <p className="text-ink-soft mt-1.5 leading-relaxed">{p.body}</p>
                  </div>
                </li>
              ))}
              <li>
                <Photo
                  src="eggs"
                  className="aspect-[16/7] w-full rounded-3xl"
                  alt="Brown eggs in a carton"
                />
              </li>
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ faq */}
        <section
          id="faq"
          aria-labelledby="faq-title"
          className="mx-auto grid max-w-7xl scroll-mt-20 gap-12 px-5 py-24 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"
        >
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <H2 id="faq-title">Straight answers.</H2>
          </div>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="market-faq paper group rounded-2xl px-6">
                <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-bold">
                  {f.q}
                  <span className="bg-sand group-open:bg-navy flex size-8 shrink-0 items-center justify-center rounded-full transition-colors group-open:text-white">
                    <Plus
                      className="size-4 transition-transform duration-300 group-open:rotate-45"
                      aria-hidden
                    />
                  </span>
                </summary>
                <p className="text-ink-soft -mt-1 pr-10 pb-6 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ final CTA */}
        <section aria-labelledby="cta-title" className="mx-auto max-w-7xl px-5 pb-24 sm:pb-28">
          <div className="relative isolate overflow-hidden rounded-[2.5rem]">
            <Photo src="restaurant-cook" className="absolute inset-0 -z-10 h-full w-full" />
            <div className="from-ink via-ink/85 to-ink/50 absolute inset-0 -z-10 bg-gradient-to-r" />
            <div className="max-w-2xl px-8 py-20 sm:px-14 sm:py-24">
              <h2
                id="cta-title"
                className="font-display text-5xl leading-[1.02] font-semibold text-white sm:text-6xl"
              >
                See your next order priced properly.
              </h2>
              <p className="text-cream mt-5 text-lg leading-relaxed">
                Open the demo as a bakery, café or restaurant. Load a list, pick a day, press one
                button.
              </p>
              <Cta variant="light" className="mt-9">
                Start with a demo kitchen
              </Cta>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="bg-navy-deep text-cream">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-[26px] leading-none text-white">
              <LogoMark tone="cream" className="size-[1.5em]" />
              <Wordmark />
            </div>
            <p className="text-cream/85 mt-4 max-w-sm leading-relaxed">
              Buy your kitchen&apos;s ingredients for less. One list, every supplier, the lowest
              delivered cost, and exactly why.
            </p>
          </div>
          <nav aria-label="Product">
            <p className="text-butter text-xs font-bold tracking-[0.14em] uppercase">Product</p>
            <ul className="text-cream/90 mt-4 space-y-2.5">
              <li>
                <Link href="/home" className="hover:text-white">
                  Live demo
                </Link>
              </li>
              <li>
                <a href="#savings" className="hover:text-white">
                  Savings
                </a>
              </li>
              <li>
                <a href="#stock" className="hover:text-white">
                  Stock
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Company">
            <p className="text-butter text-xs font-bold tracking-[0.14em] uppercase">Company</p>
            <ul className="text-cream/90 mt-4 space-y-2.5">
              <li>
                <a href="#honest" className="hover:text-white">
                  Our promise
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white">
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="text-cream/80 mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs sm:flex-row sm:justify-between">
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
