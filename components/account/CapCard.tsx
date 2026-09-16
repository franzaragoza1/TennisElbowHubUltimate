import Image from "next/image";

/** Puro adorno, pedido explícito ("just for fun") — sin datos, sin lógica. */
export function CapCard() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-rule bg-paper p-6 text-center shadow-sm">
      <p className="text-headline text-sm text-ink">The Cap Says:</p>
      <Image src="/assets/cap/cap.png" alt="" width={1254} height={1254} className="h-24 w-24" />
    </div>
  );
}
