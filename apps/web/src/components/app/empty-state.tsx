import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="bg-card/60 flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="bg-accent text-accent-foreground mb-4 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? (
        <div className="text-muted-foreground mt-1 max-w-md text-sm">{children}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
