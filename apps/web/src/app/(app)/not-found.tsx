import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn't find that page"
      action={
        <Button asChild>
          <Link href="/home">Back to Home</Link>
        </Button>
      }
    >
      The link may be out of date.
    </EmptyState>
  );
}
