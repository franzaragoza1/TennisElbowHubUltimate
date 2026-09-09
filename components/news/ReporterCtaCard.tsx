import { getCurrentUser } from "@/lib/auth";
import { getMyReporterStatus } from "@/app/account/actions";
import { SignInButton } from "@/components/account/SignInButton";
import { ReporterRequestButton } from "@/components/account/ReporterRequestButton";

/**
 * Pedido explícito: la solicitud para ser reportero (hasta ahora solo en /account)
 * también tiene que verse en /news, no solo en la cuenta — así alguien que ya está
 * leyendo noticias ve la opción sin tener que ir a buscarla. Escribir la crónica en sí
 * sigue viviendo solo en /account (es contenido personal, con sus propios borradores),
 * aquí solo el "pedir acceso".
 */
export async function ReporterCtaCard() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mb-6 flex flex-col items-start gap-3 rounded-lg border border-rule bg-paper-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-headline text-sm text-ink">Want to write for the News section?</p>
          <p className="text-muted-label mt-1 text-xs">
            Sign in to request to become a reporter — every story is reviewed before it goes live.
          </p>
        </div>
        <SignInButton callbackUrl="/news" />
      </div>
    );
  }

  const status = await getMyReporterStatus();
  if (status.isReporter) return null;

  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-lg border border-rule bg-paper-tint px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-headline text-sm text-ink">Want to write for the News section?</p>
        <p className="text-muted-label mt-1 text-xs">
          {status.pendingRequest
            ? "Your request is waiting for an admin to review it."
            : status.wasRejected
              ? "Your previous request wasn't approved — you can try again."
              : "Reporters write their own stories — every submission is reviewed before it goes live."}
        </p>
      </div>
      {!status.pendingRequest && <ReporterRequestButton />}
    </div>
  );
}
