/**
 * Punto de entrada del bot de Discord — a diferencia de `scripts/autoScrape.ts`, este
 * proceso NO termina solo: mantiene la conexión de gateway abierta indefinidamente
 * (Discord exige un WebSocket real y persistente, no algo serverless — mismo motivo
 * por el que el scraper tampoco vive en una función de Vercel, ver docs/decisiones.md
 * 2026-08-17). Pensado para correr 24/7 en el mismo servidor que ejecute el scraper,
 * o en cualquier otra máquina con acceso a la misma base de datos.
 *
 * Uso: npm run bot
 */
import { REST, Routes, Events, ChannelType, type Interaction } from "discord.js";
import { discordClient } from "../lib/discordBot/client";
import { discordBotConfig } from "../lib/discordBot/config";
import { announceNewMatchups } from "../lib/discordBot/tasks/announceMatchups";
import { announceResults } from "../lib/discordBot/tasks/announceResults";
import { updateMatchupMentions } from "../lib/discordBot/tasks/updateMatchupMentions";
import { sendReminders } from "../lib/discordBot/tasks/sendReminders";
import { syncRoles } from "../lib/discordBot/tasks/syncRoles";
import { notifyClaimApproved } from "../lib/discordBot/tasks/notifyClaimApproved";
import { notifyReporterApproved } from "../lib/discordBot/tasks/notifyReporterApproved";
import { notifyFollowersOfFinishedMatches } from "../lib/pushNotifications/notifyFinishedMatches";
import { announceAwardsVotingOpened } from "../lib/discordBot/tasks/announceAwardsVotingOpened";
import { syncAwardsPollResults } from "../lib/discordBot/tasks/syncAwardsPollResults";
import { announceAwardsVotingClosed } from "../lib/discordBot/tasks/announceAwardsVotingClosed";
import { handleConfirmButton } from "../lib/discordBot/interactions/confirmButton";
import { handleInterviewButton } from "../lib/discordBot/interactions/interviewButton";
import { handleInterviewMessage } from "../lib/discordBot/interactions/interviewMessage";
import { handleElbotMessage } from "../lib/discordBot/interactions/elbotWatcher";
import { handleGuildMemberAdd } from "../lib/discordBot/interactions/guildMemberAdd";
import { refreshLiveBoard } from "../lib/discordBot/tasks/liveBoard";
import { extendCommand, handleExtendCommand } from "../lib/discordBot/commands/extend";
import { newTournamentCommand, handleNewTournamentCommand, handleSurfaceAutocomplete } from "../lib/discordBot/commands/newTournament";
import { announceCommand, handleAnnounceCommand } from "../lib/discordBot/commands/announce";
import { acquireSingleInstanceLock } from "./lib/singleInstanceLock";

// Con el guildId dentro del nombre del lock (no solo "discordBot" a secas): permite
// correr `npm run bot` apuntado a un servidor de pruebas (guild distinto en .env, ver
// docs/decisiones.md 2026-09-20) al mismo tiempo que `npm run bot:prod` sigue vivo sin
// que se bloqueen entre sí — dos instancias contra el MISMO guild (el caso real que
// esto existe para evitar) siguen chocando exactamente igual que antes.
acquireSingleInstanceLock(`discordBot-${discordBotConfig.guildId}`);

// Fácil de ajustar: cada cuánto se repite el ciclo completo de las tareas de fondo de
// toda la vida (anunciar emparejamientos nuevos, anunciar resultados nuevos,
// recordatorios, roles, reclamaciones).
const POLL_INTERVAL_MS = 15 * 60 * 1000;

// Awards tiene SU PROPIO ciclo, mucho más corto — pedido explícito del propietario tras
// un caso real: "as soon as voting ends, the website has to display everything after".
// Con los 15 minutos de arriba, cerrar un sondeo de Discord un minuto después de que
// el ciclo general ya hubiera pasado dejaba el sitio mostrando "0 votes" hasta 15
// minutos más (bug real reportado, aunque no era un bug: solo latencia de sondeo). El
// resto de tareas no necesita este apremio, así que se quedan en su cadencia de
// siempre — separar el ciclo evita meterles peticiones de más sin motivo.
const AWARDS_POLL_INTERVAL_MS = 60 * 1000;

// El tablero "esperando rival / en vivo" también necesita su propio ciclo corto —
// pedido explícito, 2026-09-24: tiene que sentirse en vivo de verdad, 15 minutos
// (POLL_INTERVAL_MS) se notaría clarísimamente desfasado. 45s es un término medio
// razonable: bastante frecuente para sentirse actualizado, sin machacar
// live-tennis.cn ni la API de Discord (editar un mensaje) más de lo necesario.
const LIVE_BOARD_INTERVAL_MS = 45 * 1000;

async function registerSlashCommands(): Promise<void> {
  const rest = new REST().setToken(discordBotConfig.token);
  // Guild-scoped, no global: propaga al instante (un comando global tarda hasta una
  // hora en aparecer) y este bot solo vive en un servidor.
  await rest.put(Routes.applicationGuildCommands(discordClient.application!.id, discordBotConfig.guildId), {
    body: [extendCommand.toJSON(), newTournamentCommand.toJSON(), announceCommand.toJSON()],
  });
}

async function runPollCycle(): Promise<void> {
  try {
    await announceNewMatchups();
    await announceResults();
    // Aparte, en su propio try/catch — igual que la propia Discord/push por diseño
    // (design decision 8 del plan de push notifications): un fallo avisando por push
    // no debe impedir que el resto de este ciclo (menciones, recordatorios, roles...)
    // siga corriendo.
    try {
      await notifyFollowersOfFinishedMatches();
    } catch (err) {
      console.error("✗ Fallo avisando por push de resultados terminados:", err);
    }
    await updateMatchupMentions();
    await sendReminders();
    await syncRoles();
    await notifyClaimApproved();
    await notifyReporterApproved();
  } catch (err) {
    console.error("✗ Fallo en el ciclo de sondeo:", err);
  }
}

async function runAwardsPollCycle(): Promise<void> {
  try {
    await announceAwardsVotingOpened();
    await syncAwardsPollResults();
    await announceAwardsVotingClosed();
  } catch (err) {
    console.error("✗ Fallo en el ciclo de premios:", err);
  }
}

async function runLiveBoardCycle(): Promise<void> {
  try {
    await refreshLiveBoard();
  } catch (err) {
    console.error("✗ Fallo actualizando el tablero en vivo:", err);
  }
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isAutocomplete()) {
      if (interaction.commandName === "new-tournament") await handleSurfaceAutocomplete(interaction);
      return;
    }
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("confirm:")) await handleConfirmButton(interaction);
      else if (interaction.customId.startsWith("interview:")) await handleInterviewButton(interaction);
      return;
    }
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "extend") await handleExtendCommand(interaction);
      else if (interaction.commandName === "new-tournament") await handleNewTournamentCommand(interaction);
      else if (interaction.commandName === "announce") await handleAnnounceCommand(interaction);
    }
  } catch (err) {
    console.error("✗ Fallo manejando una interacción:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Something went wrong handling that — please try again.", ephemeral: true }).catch(() => {});
    }
  }
}

discordClient.once(Events.ClientReady, async (client) => {
  console.log(`✓ Bot conectado como ${client.user.tag}`);
  await registerSlashCommands();
  console.log("✓ Comandos /extend, /new-tournament, /announce registrados");

  await runPollCycle();
  await runAwardsPollCycle();
  await runLiveBoardCycle();
  setInterval(runPollCycle, POLL_INTERVAL_MS);
  setInterval(runAwardsPollCycle, AWARDS_POLL_INTERVAL_MS);
  setInterval(runLiveBoardCycle, LIVE_BOARD_INTERVAL_MS);
});

discordClient.on(Events.InteractionCreate, handleInteraction);

discordClient.on(Events.MessageCreate, (message) => {
  if (message.channel.type === ChannelType.PublicThread) {
    handleInterviewMessage(message).catch((err) => console.error("✗ Fallo procesando un mensaje de entrevista:", err));
    return;
  }
  // Nunca async/await aquí a propósito — parseElbotMessage + el estado en memoria de
  // waitingPlayers.ts son puro cálculo síncrono, sin red ni base de datos (ver el
  // comentario de ese fichero). No hace falta un .catch: no hay ninguna promesa que
  // pueda rechazar.
  handleElbotMessage(message);
});

discordClient.on(Events.GuildMemberAdd, (member) => {
  handleGuildMemberAdd(member).catch((err) => console.error("✗ Fallo mandando el mensaje de bienvenida:", err));
});

discordClient.login(discordBotConfig.token).catch((err) => {
  console.error("❌ No se pudo iniciar sesión en Discord:", err);
  process.exit(1);
});
