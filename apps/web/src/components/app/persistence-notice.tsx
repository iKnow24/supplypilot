import { DatabaseZap } from "lucide-react";

import { persistenceProblem, type Persistence } from "@/lib/session";

/** Says plainly when nothing will be saved, instead of pretending. */
export function PersistenceNotice({ persistence }: { persistence: Persistence }) {
  const problem = persistenceProblem(persistence);
  if (!problem) return null;
  return (
    <div
      role="note"
      className="bg-warning-soft text-warning mb-6 flex gap-3 rounded-xl px-4 py-3 text-sm"
    >
      <DatabaseZap className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{problem}</p>
        {persistence.status === "session_expired" ? (
          <p className="mt-0.5 opacity-90">
            Running locally? This usually means the Docker VM&apos;s clock fell behind after your
            Mac slept. Run <code className="font-mono">make db-doctor</code> to check, then quit and
            reopen OrbStack.
          </p>
        ) : persistence.status !== "ready" ? (
          <p className="mt-0.5 opacity-90">
            Running locally? Start the database with{" "}
            <code className="font-mono">make db-start</code>, then{" "}
            <code className="font-mono">make db-env</code>, and restart{" "}
            <code className="font-mono">make web</code>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
