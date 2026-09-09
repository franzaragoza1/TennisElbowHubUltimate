"use client";

import { useTransition } from "react";
import { approvePendingSubmission, rejectPendingSubmission } from "@/app/admin/awards/actions";

/** Aprobar/rechazar un envío pendiente de Point of the Month — esto no existía en
 * absoluto antes (bug real: dos envíos se quedaron sin revisar y esa categoría se
 * publicó sin nominados, ver el comentario de approvePendingSubmission). Sin gate por
 * `detail.status` a propósito: un envío puede llegar o quedarse sin revisar incluso
 * después de abrir la votación. */
export function PendingSubmissionButtons({ nominationId, onDone }: { nominationId: number; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      await approvePendingSubmission(withId(nominationId));
      onDone();
    });
  }

  function reject() {
    startTransition(async () => {
      await rejectPendingSubmission(withId(nominationId));
      onDone();
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-3">
      <button type="button" onClick={approve} disabled={isPending} className="text-eyebrow text-xs text-blue-500 hover:underline disabled:opacity-50">
        Approve
      </button>
      <button type="button" onClick={reject} disabled={isPending} className="text-eyebrow text-xs text-down hover:underline disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}

function withId(nominationId: number): FormData {
  const formData = new FormData();
  formData.set("nominationId", String(nominationId));
  return formData;
}
