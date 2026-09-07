/**
 * IDs de los roles de logro del servidor (World No. 1, Grand Slam Champion, etc.) —
 * a diferencia de `config.ts` (que falla ruidosamente si falta CUALQUIERA de sus
 * variables, porque el bot entero no tiene sentido sin ellas), estos son opcionales:
 * mientras el propietario no los configure, `lib/discordBot/tasks/syncRoles.ts`
 * simplemente no hace nada con el rol que falte — nunca debe tirar abajo el resto del
 * bot (anuncios, recordatorios) por un rol de Discord sin configurar todavía.
 */
function optional(name: string): string | null {
  return process.env[name] || null;
}

export const discordRoleConfig = {
  /** Cualquier jugador con perfil reclamado y Discord vinculado — no un logro, una
   * identidad de base ("eres un jugador real del tour"), así que se da a todo el que
   * cumpla eso sin necesidad de haber ganado nada todavía. */
  tourPlayer: optional("DISCORD_ROLE_TOUR_PLAYER"),
  worldNo1: optional("DISCORD_ROLE_WORLD_NO_1"),
  grandSlamChampion: optional("DISCORD_ROLE_GRAND_SLAM_CHAMPION"),
  tourFinalsChampion: optional("DISCORD_ROLE_TOUR_FINALS_CHAMPION"),
  masters1000Champion: optional("DISCORD_ROLE_MASTERS_1000_CHAMPION"),
  fiveHundredChampion: optional("DISCORD_ROLE_500_CHAMPION"),
  twoFiftyChampion: optional("DISCORD_ROLE_250_CHAMPION"),
  challengerChampion: optional("DISCORD_ROLE_CHALLENGER_CHAMPION"),
  futuresChampion: optional("DISCORD_ROLE_FUTURES_CHAMPION"),
};
