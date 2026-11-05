"use client";

import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        action={<Button onClick={reset}>Try again</Button>}
      >
        This page didn&apos;t load. Your data hasn&apos;t changed.
      </EmptyState>
    </div>
  );
}
