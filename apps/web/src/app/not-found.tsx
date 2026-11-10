import { SearchX } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { EmptyState } from "@/components/app/empty-state";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

/** Unmatched URLs: no app chrome, so give the page its own frame. */
export default async function NotFound() {
  await connection(); // per-request CSP nonce
  return (
    <div className="dots flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5">
        <Logo />
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-xl flex-1 px-5 pt-16 outline-none"
      >
        <EmptyState
          icon={SearchX}
          title="We couldn't find that page"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/home">Open the app</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to the homepage</Link>
              </Button>
            </div>
          }
        >
          The link may be out of date.
        </EmptyState>
      </main>
    </div>
  );
}
