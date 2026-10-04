/**
 * Anuncio automático al abrir inscripción de un torneo — pedido explícito del
 * propietario (2026-10-04), mismo formato que ya publicaba a mano con `/new-tournament`
 * pero disparado solo cuando `lib/mana/loadTournament.ts::loadTournamentByExternalId`
 * carga una edición NUEVA todavía en `"registration"` (nunca al refrescar una ya
 * conocida, nunca una vez el cuadro ya existe — eso ya no es "se abrió inscripción").
 *
 * REST puro, SIN el cliente de gateway (`../client`) a propósito: quien llama a esto
 * (`loadTournamentByExternalId`) corre tanto dentro del proceso `scraper` de
 * `scripts/autoScrape.ts` como, en local, dentro del propio proceso de Next — ninguno
 * de los dos mantiene una conexión de gateway viva, solo el proceso aparte
 * `scripts/discordBot.ts` la tiene. Mismo patrón ya establecido por
 * `lib/discordBot/pollRest.ts` para esta misma razón.
 *
 * `DISCORD_NEW_TOURNAMENT_CHANNEL_ID` es opcional, igual que el resto de canales de
 * Awards/Live Board — sin configurar, esta tarea simplemente no hace nada.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { editions, events, matches, players } from "@/db/schema";
import { discordCategoryColorNumber } from "@/lib/categoryColor";
import { getCountryCode } from "@/lib/countryCodes";
import { getCategoryRules, normalizeCategoryForDisplay } from "@/lib/tournamentCategoryRules";
import { getTournamentLogoUrl } from "@/lib/tournamentLogos";
import { manaTournamentUrl } from "@/lib/mana/links";
import { countryCodeToFlagEmoji } from "../flagEmoji";
import { calculateSchedule } from "../tournamentScheduleMath";

interface FinalistDisplay {
  name: string;
  flag: string; // "" sin país reconocido — nunca se inventa una bandera
}

/** Campeón/subcampeón de la edición del MISMO evento del año anterior, si la hay y su
 * Final está decidida — `null` en cualquier otro caso (evento nuevo, año sin
 * precedente, Final sin jugar todavía) en vez de forzar la sección. */
async function getPriorYearFinalists(eventId: number, priorYear: number): Promise<{ winner: FinalistDisplay; runnerUp: FinalistDisplay } | null> {
  const p1 = alias(players, "finalist_p1");
  const p2 = alias(players, "finalist_p2");

  const [row] = await db
    .select({
      winnerId: matches.winnerId,
      player1Id: matches.player1Id,
      player1Name: p1.displayName,
      player1Country: p1.country,
      player2Id: matches.player2Id,
      player2Name: p2.displayName,
      player2Country: p2.country,
    })
    .from(matches)
    .innerJoin(editions, eq(editions.id, matches.editionId))
    .innerJoin(p1, eq(p1.id, matches.player1Id))
    .innerJoin(p2, eq(p2.id, matches.player2Id))
    .where(and(eq(editions.eventId, eventId), eq(editions.year, priorYear), eq(matches.round, "F")))
    .limit(1);
  if (!row || row.winnerId === null) return null;

  const winnerIsP1 = row.winnerId === row.player1Id;
  const toDisplay = (name: string, country: string | null): FinalistDisplay => {
    const code = getCountryCode(country);
    return { name, flag: code ? countryCodeToFlagEmoji(code) : "" };
  };
  return {
    winner: toDisplay(winnerIsP1 ? row.player1Name : row.player2Name, winnerIsP1 ? row.player1Country : row.player2Country),
    runnerUp: toDisplay(winnerIsP1 ? row.player2Name : row.player1Name, winnerIsP1 ? row.player2Country : row.player1Country),
  };
}

interface DiscordEmbed {
  description: string;
  color: number;
  thumbnail?: { url: string };
}

function buildMessageForm(embed: DiscordEmbed, attachmentPath: string | null): FormData {
  const form = new FormData();
  if (attachmentPath) {
    const fileName = path.basename(attachmentPath);
    embed.thumbnail = { url: `attachment://${fileName}` };
    form.append("files[0]", new Blob([fs.readFileSync(attachmentPath)]), fileName);
    // Explícito a propósito en una EDICIÓN (PATCH) — sin esto, Discord conserva
    // cualquier adjunto del mensaje original que no se vuelva a listar aquí, dejando
    // el escudo viejo colgado junto al nuevo en vez de reemplazarlo.
    form.append("payload_json", JSON.stringify({ embeds: [embed], attachments: [{ id: 0, filename: fileName }] }));
  } else {
    form.append("payload_json", JSON.stringify({ embeds: [embed], attachments: [] }));
  }
  return form;
}

async function postMessageWithOptionalAttachment(channelId: string, embed: DiscordEmbed, attachmentPath: string | null): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN isn't configured.");

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}` },
    body: buildMessageForm(embed, attachmentPath),
  });
  if (!res.ok) {
    throw new Error(`Discord returned ${res.status} posting the new-tournament announcement: ${await res.text()}`);
  }
}

/** Corrige un anuncio YA PUBLICADO (p.ej. tras arreglar un bug de formato) en vez de
 * publicar uno nuevo — mismo criterio seguido el resto de esta sesión: un fallo de
 * formato ya visible en Discord se corrige también ahí, no solo en el código de cara
 * al futuro. */
export async function editAnnouncement(channelId: string, messageId: string, embed: DiscordEmbed, attachmentPath: string | null): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN isn't configured.");

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: { Authorization: `Bot ${token}` },
    body: buildMessageForm(embed, attachmentPath),
  });
  if (!res.ok) {
    throw new Error(`Discord returned ${res.status} editing the new-tournament announcement: ${await res.text()}`);
  }
}

export interface BuiltAnnouncement {
  embed: DiscordEmbed;
  attachmentPath: string | null;
}

/** Construye el embed (y, si hay escudo, la ruta de su fichero) sin publicar nada —
 * separado de `announceNewTournamentRegistrationOpen` para poder REUTILIZARLO al
 * corregir un mensaje ya publicado (editar en vez de publicar otra vez), sin duplicar
 * el formato en dos sitios que pudieran desincronizarse. `null` en los mismos casos
 * que antes (edición no encontrada, sin semana ISO). */
export async function buildAnnouncement(editionId: number): Promise<BuiltAnnouncement | null> {
  const [row] = await db
    .select({
      eventId: editions.eventId,
      eventName: events.displayName,
      year: editions.year,
      isoWeek: editions.isoWeek,
      surface: editions.surface,
      category: editions.category,
      competition: editions.competition,
      drawSize: editions.drawSize,
      officialTopicUrl: editions.officialTopicUrl,
      externalId: editions.externalId,
    })
    .from(editions)
    .innerJoin(events, eq(events.id, editions.eventId))
    .where(eq(editions.id, editionId));
  // Sin semana ISO no hay nada que programar (nunca visto en la práctica para una
  // edición real de Mana, pero el tipo es nullable — mismo criterio defensivo que el
  // resto de lib/liveRanking/*, nunca se inventa una semana).
  if (!row || row.isoWeek === null) return null;

  const finalists = await getPriorYearFinalists(row.eventId, row.year - 1);
  const { startDate, queueUntil } = calculateSchedule(row.isoWeek, row.year);
  const category = normalizeCategoryForDisplay(row.category);
  const rules = getCategoryRules(category);

  const lines: string[] = [`# 🏆 ${row.eventName}`, "\n## 📋 Tournament Info", `**Category:** ${category}`];
  if (row.surface) lines.push(`**Surface:** ${row.surface}`);
  lines.push(`**Draw Size:** ${row.drawSize} Players (${row.competition})`);

  if (rules) {
    lines.push("\n**Notes & Rules:**");
    lines.push(`• Elo Limit: ≈ ${rules.eloLimit}`);
    lines.push(`• Danger Zone: ${rules.dangerZoneAllowed ? "Allowed" : "Not Allowed"}`);
  }

  lines.push("\n## 📅 Schedule", `**Calendar Week:** Week ${row.isoWeek}`, `**Queue Until:** ${queueUntil}`, `**Start Date:** ${startDate}`);

  if (finalists) {
    lines.push(`\n## 🏆 ${row.year - 1} Finalists`);
    lines.push(`**🥇 Winner:** ${finalists.winner.name}${finalists.winner.flag ? ` ${finalists.winner.flag}` : ""}`);
    lines.push(`**🥈 Runner Up:** ${finalists.runnerUp.name}${finalists.runnerUp.flag ? ` ${finalists.runnerUp.flag}` : ""}`);
  }

  // El enlace al hilo del foro no siempre está parseado todavía en el momento de abrir
  // inscripción (bug real reportado, 2026-10-04: Almaty/Lyon salieron sin "Register
  // Now!" porque `officialTopicUrl` seguía null) — cae a la propia página del torneo
  // en Mana (`manaTournamentUrl`, siempre construible desde el Trn= que ya tenemos),
  // nunca se omite la sección entera por esto.
  const registerLink = row.officialTopicUrl ?? manaTournamentUrl(row.externalId);
  lines.push(`\n## [🔗 Register Now!](${registerLink})`);

  const embed: DiscordEmbed = { description: lines.join("\n"), color: discordCategoryColorNumber(category) };

  const logoUrl = getTournamentLogoUrl(row.eventName);
  const logoFilePath = logoUrl ? path.join(process.cwd(), "public", logoUrl) : null;
  const attachmentPath = logoFilePath && fs.existsSync(logoFilePath) ? logoFilePath : null;

  return { embed, attachmentPath };
}

export async function announceNewTournamentRegistrationOpen(editionId: number): Promise<void> {
  const channelId = process.env.DISCORD_NEW_TOURNAMENT_CHANNEL_ID;
  if (!channelId) return;

  const built = await buildAnnouncement(editionId);
  if (!built) return;

  await postMessageWithOptionalAttachment(channelId, built.embed, built.attachmentPath);
}
