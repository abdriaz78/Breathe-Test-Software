"use client";

import { useEffect, useState } from "react";

// Time-of-day greeting computed in the browser, so it follows the viewer's
// local clock rather than the server's timezone.
export function Greeting({ name }: { name: string }) {
  const [part, setPart] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setPart(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    setToday(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  const first = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").split(/\s+/)[0] || name;
  return (
    <>
      <p className="text-sm font-medium text-brand-100/90">{today || " "}</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {part ?? "Welcome"}, {first}
      </h1>
    </>
  );
}
