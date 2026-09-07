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
import { sendReminders } from "../lib/discordBot/tasks/sendReminders";
import { syncRoles } from "../lib/discordBot/tasks/syncRoles";
import { handleConfirmButton } from "../lib/discordBot/interactions/confirmButton";
import { handleInterviewButton } from "../lib/discordBot/interactions/interviewButton";
import { handleInterviewMessage } from "../lib/discordBot/interactions/interviewMessage";
import { extendCommand, handleExtendCommand } from "../lib/discordBot/commands/extend";
import { newTournamentCommand, handleNewTournamentCommand, handleSurfaceAutocomplete } from "../lib/discordBot/commands/newTournament";
import { announceCommand, handleAnnounceCommand } from "../lib/discordBot/commands/announce";

// Fácil de ajustar: cada cuánto se repite el ciclo completo de las tres tareas de
// fondo (anunciar emparejamientos nuevos, anunciar resultados nuevos, recordatorios).
const POLL_INTERVAL_MS = 15 * 60 * 1000;

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
    await sendReminders();
    await syncRoles();
  } catch (err) {
    console.error("✗ Fallo en el ciclo de sondeo:", err);
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
  setInterval(runPollCycle, POLL_INTERVAL_MS);
});

discordClient.on(Events.InteractionCreate, handleInteraction);

discordClient.on(Events.MessageCreate, (message) => {
  if (message.channel.type === ChannelType.PublicThread) {
    handleInterviewMessage(message).catch((err) => console.error("✗ Fallo procesando un mensaje de entrevista:", err));
  }
});

discordClient.login(discordBotConfig.token).catch((err) => {
  console.error("❌ No se pudo iniciar sesión en Discord:", err);
  process.exit(1);
});
