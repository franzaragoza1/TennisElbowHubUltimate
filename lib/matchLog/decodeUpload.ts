/**
 * TE4 declara `charset=iso-8859-1` en el propio `<meta>` del MatchLog, pero para un
 * nombre de jugador no-ASCII (acentos, cirílico, CJK...) el motor escribe UTF-8 de
 * verdad ahí dentro — el charset declarado miente. Decodificar siempre como iso-8859-1
 * corrompe justo esos nombres en mojibake (p.ej. "Gabriel LOURENÇO" se guardaba como
 * "Gabriel LOURENÃ‡O"), que son los que más falta hacen para casar bien contra el
 * roster del tour: un nombre corrompido nunca puede coincidir exactamente con
 * `players.displayName`/`player_known_names`, así que el partido se descartaba como
 * "not a known tour player" sin serlo de verdad.
 *
 * Se prueba UTF-8 primero en modo estricto (`fatal: true`): si el fichero es UTF-8 de
 * verdad, decodifica limpio. Si no lo es (de verdad venía en iso-8859-1/windows-1252
 * legado, sin ningún nombre no-ASCII de por medio para delatarlo), `TextDecoder` lanza
 * y se cae al decodificador legado — un fichero solo-ASCII decodifica idéntico en los
 * dos casos, así que esto nunca empeora nada, solo arregla el caso no-ASCII.
 */
export function decodeMatchLogHtml(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
}
