import Link from "next/link";
import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn't find that page"
      action={
        <Button asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      }
    >
      The link may be out of date.
    </EmptyState>
  );
}
