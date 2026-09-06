import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
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
    // Copia el avatar de Discord a `players.avatar_url` si este usuario ya tiene un
    // jugador vinculado — instantánea, no JOIN en vivo (ver comentario en
    // db/schema.ts::players.avatarUrl). No hace nada si todavía no hay jugador
    // vinculado (recién entrado, sin reclamar ni crear perfil), NI si el jugador ya
    // subió una foto propia (`avatarIsCustom`) — si no, cada login volvería a pisarla
    // con el avatar de Discord sin que nadie lo pidiera.
    async signIn({ user }) {
      if (!user.id || !user.image) return;
      await db
        .update(players)
        .set({ avatarUrl: user.image })
        .where(and(eq(players.linkedUserId, user.id), eq(players.avatarIsCustom, false)));
    },
  },
});
