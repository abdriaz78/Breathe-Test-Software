"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { StatusScreen } from "@/components/ui/StatusScreen";

// Shown when a page throws (e.g. the database is briefly unreachable). The
// error details stay in the server logs; `digest` lets support correlate them.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusScreen
      code="Oops"
      title="Something went wrong"
      message={`This page couldn't be loaded. It's usually a temporary connection problem — please try again.${
        error.digest ? ` (Reference: ${error.digest})` : ""
      }`}
      actions={
        <>
          <button onClick={reset} className="btn-primary">
            <Icon name="history" className="h-4 w-4" /> Try again
          </button>
          <Link href="/" className="btn-secondary">
            <Icon name="home" className="h-4 w-4" /> Dashboard
          </Link>
        </>
      }
    />
  );
}
