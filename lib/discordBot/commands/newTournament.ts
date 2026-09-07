/**
 * `/new-tournament` — portado del bot Python "side code" del propietario (un segundo
 * bot que corría aparte, con sus propios `/new-tournament` y `/announce`). Pedido
 * explícito: "id rather have it in one place" — un solo bot, un solo proceso.
 *
 * Dos cosas del original NO se replican tal cual, a propósito:
 * - El icono de superficie salía de una carpeta local `XKTTBSTD/` (60MB, fuera de git,
 *   ver .gitignore) — ese material no existe dentro de la imagen Docker del bot
 *   (excluido en .dockerignore). En su lugar se reutiliza `public/tournament-logos/`,
 *   el mismo set ya aplanado y commiteado que usa la web (lib/tournamentLogos.ts).
 *   Pedido explícito del propietario: "Use the already present assets tho."
 * - La lista de superficies para el autocompletado salía de un `surfaces.txt` propio
 *   del bot Python — se reutiliza `lib/liveTennis/surfaces.ts` (la misma lista real de
 *   pistas del tour, ya usada por Live Scores) en vez de mantener una copia aparte.
 *
 * Solo publica el embed de anuncio, igual que el original — no crea nada en la base de
 * datos del sitio (Native Tournaments es una función aparte).
 */
import fs from "node:fs";
import path from "node:path";
import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { loadKnownSurfaces } from "@/lib/liveTennis/surfaces";
import { slugifyLogoFolder } from "@/lib/tournamentLogos";
import { discordCategoryColorNumber } from "@/lib/categoryColor";

// Únicas superficies "base" del juego sin torneo real detrás — no viven en
// lib/liveTennis/surfaces.ts (esa lista es solo pistas reales del tour), así que se
// añaden aparte, igual que hacía el bot Python.
const VANILLA_BASE_SURFACES = [
  "Clay",
  "Grass",
  "Classic Synthetic",
  "Cement",
  "Indoor Carpet",
  "Indoor Hard",
  "Blue-Green Cement",
  "NewLine Synthetic",
  "Green Clay",
];

function getAllSurfaces(): string[] {
  const combined = [...VANILLA_BASE_SURFACES];
  const seenLower = new Set(combined.map((s) => s.toLowerCase()));
  for (const surface of loadKnownSurfaces()) {
    if (!seenLower.has(surface.toLowerCase())) {
      combined.push(surface);
      seenLower.add(surface.toLowerCase());
    }
  }
  return combined;
}


const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatWithSuffix(date: Date): string {
  const day = date.getUTCDate();
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${day}${ordinalSuffix(day)}`;
}

// Lunes de la semana ISO `week` del año `year` — mismo resultado que
// `datetime.date.fromisocalendar` de Python (el 4 de enero SIEMPRE cae en la semana 1
// del calendario ISO, es el ancla estándar del algoritmo).
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // domingo=0 -> 7, para que lunes=1..domingo=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

function calculateSchedule(targetWeek: number, year: number): { startDate: string; queueUntil: string } {
  const monday = isoWeekMonday(year, targetWeek);
  const startDate = new Date(monday);
  startDate.setUTCDate(monday.getUTCDate() - 2); // sábado anterior
  const queueUntil = new Date(startDate);
  queueUntil.setUTCDate(startDate.getUTCDate() - 1); // viernes anterior a ese sábado
  return { startDate: formatWithSuffix(startDate), queueUntil: formatWithSuffix(queueUntil) };
}

// Busca el icono ya aplanado en public/tournament-logos/ por el nombre de superficie
// elegido (no por nombre de evento — el original tampoco lo hacía). Si esa superficie
// nunca se copió a public/tournament-logos/, se publica sin thumbnail, a propósito.
function findSurfaceIconPath(surface: string): string | null {
  const filePath = path.join(process.cwd(), "public", "tournament-logos", `${slugifyLogoFolder(surface)}.png`);
  return fs.existsSync(filePath) ? filePath : null;
}

export const newTournamentCommand = new SlashCommandBuilder()
  .setName("new-tournament")
  .setDescription("Create an official XKT Tournament post")
  .addChannelOption((opt) =>
    opt.setName("channel").setDescription("The target text channel for the announcement").addChannelTypes(ChannelType.GuildText).setRequired(true),
  )
  .addStringOption((opt) => opt.setName("name").setDescription("Tournament Name (e.g. Miami Open)").setRequired(true))
  .addIntegerOption((opt) => opt.setName("draw_size").setDescription("Number of players in the draw (e.g. 64)").setRequired(true))
  .addStringOption((opt) =>
    opt
      .setName("competition")
      .setDescription("Singles or Doubles")
      .setRequired(true)
      .addChoices({ name: "Singles", value: "Singles" }, { name: "Doubles", value: "Doubles" }),
  )
  .addStringOption((opt) => opt.setName("surface").setDescription("Main tournament court surface").setRequired(true).setAutocomplete(true))
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("Tournament tier")
      .setRequired(true)
      .addChoices(
        { name: "Grand Slam", value: "Grand Slam" },
        { name: "Masters 1000", value: "Masters 1000" },
        { name: "500", value: "500" },
        { name: "250", value: "250" },
        { name: "Challenger 125", value: "Challenger 125" },
        { name: "Challenger 100", value: "Challenger 100" },
        { name: "Challenger 75", value: "Challenger 75" },
        { name: "CT 125", value: "CT 125" },
        { name: "CT 110", value: "CT 110" },
        { name: "CT 100", value: "CT 100" },
        { name: "CT 90", value: "CT 90" },
        { name: "CT 80", value: "CT 80" },
        { name: "CT 75", value: "CT 75" },
        { name: "Future", value: "Future" },
        { name: "Exhibition", value: "Exhibition" },
        { name: "Other", value: "Other" },
      ),
  )
  .addIntegerOption((opt) => opt.setName("week").setDescription("Calendar week number").setRequired(true))
  .addStringOption((opt) => opt.setName("register_link").setDescription("Registration forum URL").setRequired(true))
  .addStringOption((opt) => opt.setName("vanilla_surface").setDescription("Optional: Vanilla game fallback surface").setAutocomplete(true))
  .addStringOption((opt) => opt.setName("custom_note_1").setDescription("Optional: First custom rule/limit"))
  .addStringOption((opt) => opt.setName("custom_note_2").setDescription("Optional: Second custom rule/limit"))
  .addStringOption((opt) => opt.setName("current_week").setDescription("Optional: Header context info"))
  .addIntegerOption((opt) => opt.setName("year").setDescription("Optional: Override archive year (defaults to current year)"))
  .addUserOption((opt) => opt.setName("winner_user").setDescription("Optional: TAG the Winner (if in server)"))
  .addStringOption((opt) => opt.setName("winner_name").setDescription("Optional: TYPE the Winner's name (if not in server)"))
  .addUserOption((opt) => opt.setName("runner_up_user").setDescription("Optional: TAG the Runner Up (if in server)"))
  .addStringOption((opt) => opt.setName("runner_up_name").setDescription("Optional: TYPE the Runner Up's name (if not in server)"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function handleNewTournamentCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel("channel", true, [ChannelType.GuildText]);
  const name = interaction.options.getString("name", true);
  const drawSize = interaction.options.getInteger("draw_size", true);
  const competition = interaction.options.getString("competition", true);
  const surface = interaction.options.getString("surface", true);
  const category = interaction.options.getString("category", true);
  const week = interaction.options.getInteger("week", true);
  const registerLink = interaction.options.getString("register_link", true);
  const vanillaSurface = interaction.options.getString("vanilla_surface");
  const customNote1 = interaction.options.getString("custom_note_1");
  const customNote2 = interaction.options.getString("custom_note_2");
  const currentWeek = interaction.options.getString("current_week");
  const year = interaction.options.getInteger("year") ?? new Date().getFullYear();
  const winnerUser = interaction.options.getUser("winner_user");
  const winnerName = interaction.options.getString("winner_name");
  const runnerUpUser = interaction.options.getUser("runner_up_user");
  const runnerUpName = interaction.options.getString("runner_up_name");

  const { startDate, queueUntil } = calculateSchedule(week, year);

  const lines: string[] = [];
  if (currentWeek) lines.push(`*${currentWeek}*\n`);
  lines.push(`# 🏆 ${name}`);
  lines.push("\n## 📋 Tournament Info");
  lines.push(`**Category:** ${category}`);

  let surfaceLine = `**Surface:** ${surface}`;
  if (vanillaSurface) surfaceLine += ` or ${vanillaSurface} if both players are playing the vanilla game`;
  lines.push(surfaceLine);
  lines.push(`**Draw Size:** ${drawSize} Players (${competition})`);

  if (customNote1 || customNote2) {
    lines.push("\n**Notes & Rules:**");
    if (customNote1) lines.push(`• ${customNote1}`);
    if (customNote2) lines.push(`• ${customNote2}`);
  }

  lines.push("\n## 📅 Schedule");
  lines.push(`**Calendar Week:** Week ${week}`);
  lines.push(`**Queue Until:** ${queueUntil}`);
  lines.push(`**Start Date:** ${startDate}`);

  const winnerDisplay = winnerUser ? `<@${winnerUser.id}>` : winnerName;
  const runnerUpDisplay = runnerUpUser ? `<@${runnerUpUser.id}>` : runnerUpName;
  if (winnerDisplay || runnerUpDisplay) {
    lines.push(`\n## 🏆 ${year - 1} Finalists`);
    if (winnerDisplay) lines.push(`**🥇 Winner:** ${winnerDisplay}`);
    if (runnerUpDisplay) lines.push(`**🥈 Runner Up:** ${runnerUpDisplay}`);
  }

  lines.push(`\n## [🔗 Register Now!](${registerLink})`);

  const embed = new EmbedBuilder().setDescription(lines.join("\n")).setColor(discordCategoryColorNumber(category));

  const iconPath = findSurfaceIconPath(surface);
  const files: AttachmentBuilder[] = [];
  if (iconPath) {
    const filename = path.basename(iconPath);
    files.push(new AttachmentBuilder(iconPath, { name: filename }));
    embed.setThumbnail(`attachment://${filename}`);
  }

  await channel.send({ embeds: [embed], files });
  await interaction.reply({ content: `✅ Post sent successfully in ${channel}!`, ephemeral: true });
}

export async function handleSurfaceAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const current = interaction.options.getFocused().toLowerCase();
  const matches = getAllSurfaces().filter((s) => s.toLowerCase().includes(current)).slice(0, 25);
  await interaction.respond(matches.map((s) => ({ name: s, value: s })));
}
