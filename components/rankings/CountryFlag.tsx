import { getCountryCode } from "@/lib/countryCodes";

export function CountryFlag({
  country,
  className = "absolute inset-0 h-full w-full rounded-full object-cover",
}: {
  country: string | null;
  className?: string;
}) {
  const code = getCountryCode(country);
  if (!code) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- icono decorativo diminuto, no vale la pena el pipeline de next/image
    <img src={`/flags/${code.toLowerCase()}.svg`} alt="" className={className} />
  );
}
