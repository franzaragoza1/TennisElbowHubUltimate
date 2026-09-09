"use client";

import { useTransition } from "react";
import { removeNomination } from "@/app/admin/awards/actions";

export function DeleteNominationButton({ nominationId, onRemoved }: { nominationId: number; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("nominationId", String(nominationId));
      await removeNomination(formData);
      onRemoved();
    });
  }

  return (
    <button type="button" onClick={handleClick} disabled={isPending} className="text-eyebrow shrink-0 text-xs text-down hover:underline disabled:opacity-50">
      Remove
    </button>
  );
}
