import NextAuth from "next-auth";
import Discord, { type DiscordProfile } from "next-auth/providers/discord";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  authUsers,
  authAccounts,
  authSessions,
  authVerificationTokens,
  players,
} from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js confía en el host de la petición automáticamente en Vercel (lo detecta
  // solo), pero no en Render ni en ningún otro hospedaje propio — sin esto rechaza
  // CUALQUIER petición de auth con un "Configuration"/"Server error" genérico (pase
  // de auto-hospedaje, 2026-09-15). Seguro aquí: el propio Render ya solo enruta
  // tráfico real de `xkt-tour.com`/`www.xkt-tour.com` (dominio propio verificado),
  // nadie puede suplantar el host de fuera.
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  providers: [Discord],
  session: { strategy: "database" },
  pages: { signIn: "/account" },
  events: {
    /**
     * `authUsers.image`/`.name` solo se rellenan al CREAR el usuario — el adaptador
     * de Auth.js nunca los vuelve a tocar en logins posteriores, así que si alguien
     * cambia su avatar en Discord, `authUsers.image` se queda con la URL vieja para
     * siempre. Una URL de avatar vieja de Discord además deja de servir el archivo en
     * cuanto Discord recicla ese hash concreto (real, 2026-09-19: "bradut"/Dani21,
     * avatar antiguo, 404 confirmado — ni comentarios ni la clasificación de
     * predictores, ambos leyendo `authUsers.image` tal cual, tenían nada que pintar).
     *
     * Recalculado aquí en CADA login desde `profile` (el perfil crudo de Discord de
     * esta misma sesión, siempre fresco) — nunca desde `user`, que para un usuario ya
     * existente es la fila YA GUARDADA en base de datos, potencialmente vieja. Misma
     * fórmula que usa el proveedor por dentro (@auth/core/providers/discord.js) para
     * no depender de que mute el objeto que nos pasa.
     */
    async signIn({ user, profile }) {
      if (!user.id || !profile) return;
      const discordProfile = profile as DiscordProfile;
      // Misma fórmula que @auth/core/providers/discord.js: sin avatar propio, Discord
      // sirve uno de sus avatares "embed" por defecto (elegido a partir del id/
      // discriminator) — nunca null, para no dejar `authUsers.image` vacío cuando el
      // usuario simplemente no ha subido nunca una foto a Discord.
      const freshImage = discordProfile.avatar
        ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.${discordProfile.avatar.startsWith("a_") ? "gif" : "png"}`
        : `https://cdn.discordapp.com/embed/avatars/${discordProfile.discriminator === "0" ? Number(BigInt(discordProfile.id) >> BigInt(22)) % 6 : parseInt(discordProfile.discriminator, 10) % 5}.png`;
      const freshName = discordProfile.global_name ?? discordProfile.username ?? null;

      await db
        .update(authUsers)
        .set({ image: freshImage, name: freshName ?? undefined })
        .where(eq(authUsers.id, user.id));

      // Copia el avatar fresco a `players.avatar_url` si este usuario ya tiene un
      // jugador vinculado — instantánea, no JOIN en vivo (ver comentario en
      // db/schema.ts::players.avatarUrl). No hace nada si todavía no hay jugador
      // vinculado (recién entrado, sin reclamar ni crear perfil), NI si el jugador ya
      // subió una foto propia (`avatarIsCustom`) — si no, cada login volvería a
      // pisarla con el avatar de Discord sin que nadie lo pidiera.
      await db
        .update(players)
        .set({ avatarUrl: freshImage })
        .where(and(eq(players.linkedUserId, user.id), eq(players.avatarIsCustom, false)));
    },
  },
});
