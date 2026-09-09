"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestNewsReporter } from "@/app/account/actions";

/** Extraído de ReporterSection.tsx para que components/news/ReporterCtaCard.tsx (el
 * mismo pedido, ahora también visible en /news, no solo en /account) pueda ofrecer el
 * mismo botón sin duplicar la mutación. */
export function ReporterRequestButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRequest() {
    startTransition(async () => {
      await requestNewsReporter();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleRequest}
      disabled={isPending}
      className="text-eyebrow shrink-0 rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
    >
      {isPending ? "Requesting…" : "Request to become a reporter"}
    </button>
  );
}
