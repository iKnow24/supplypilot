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
    <div className="dots bg-card/70 relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="bg-card shadow-raised text-primary mb-5 flex size-12 items-center justify-center rounded-2xl">
        <Icon className="size-5" aria-hidden />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children ? (
        <div className="text-muted-foreground mt-1.5 max-w-md text-sm">{children}</div>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
