"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import type { ActionResult } from "@/app/cart/actions";
import { cn } from "@/lib/utils";

type Message = { kind: "ok" | "error"; text: string; id: number };

const AnnounceContext = createContext<(kind: Message["kind"], text: string) => void>(() => {});

/** One toast + screen-reader live region for every cart action on the page. */
export function StatusProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = useCallback((kind: Message["kind"], text: string) => {
    setMessage({ kind, text, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!message) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), message.kind === "error" ? 8000 : 4000);
    return () => clearTimeout(timer.current);
  }, [message]);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
        <div role="status" aria-live="polite" aria-label="Updates" className="sr-only">
          {message?.kind === "ok" ? message.text : ""}
        </div>
        <div role="alert" className="sr-only">
          {message?.kind === "error" ? message.text : ""}
        </div>
        {message ? (
          <p
            key={message.id}
            aria-hidden
            className={cn(
              "pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg",
              message.kind === "error"
                ? "bg-destructive-soft text-destructive border-transparent"
                : "bg-card text-foreground",
            )}
          >
            {message.kind === "error" ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
            )}
            {message.text}
          </p>
        ) : null}
      </div>
    </AnnounceContext.Provider>
  );
}

/** Run a server action in a transition and announce its result. */
export function useAction() {
  const announce = useContext(AnnounceContext);
  const [pending, startTransition] = useTransition();
  const run = useCallback(
    (fn: () => Promise<ActionResult>, onDone?: (r: ActionResult) => void) => {
      startTransition(async () => {
        let result: ActionResult;
        try {
          result = await fn();
        } catch {
          result = { ok: false, error: "Couldn't reach the server. Check your connection." };
        }
        if (!result.ok) announce("error", result.error);
        else if (result.message) announce("ok", result.message);
        onDone?.(result);
      });
    },
    [announce],
  );
  return { pending, run, announce };
}
