"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import * as htmlToImage from "html-to-image";
import { searchMatchCandidates, type MatchCandidateOption } from "@/app/admin/videos/actions";
import { getMatchThumbnailData } from "@/app/admin/thumbnails/actions";
import styles from "./ThumbnailCanvas.module.css";

const DEFAULT_LOGO = "/assets/logo.png";
const DEFAULT_ACCENT = "#d4ff00";
const DEFAULT_CHANNEL = "XKT TOUR";
const DEFAULT_TITLE_LINE_2 = "FULL MATCH";

interface PlayerFieldState {
  name: string;
  avatar: string | null; // data URI, o null -> círculo de iniciales
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + (last ?? "")).toUpperCase();
}

/** Lee un fichero local como data URI — mismo mecanismo que `loadDoubleImage` de la
 * referencia del propietario, para una subida manual (jugador sin avatar, o un
 * escudo de torneo que sustituya al logo por defecto). Un data URI nunca tiene
 * problema de CORS al exportar con `html-to-image`, a diferencia de una URL remota. */
function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function PlayerBox({ player }: { player: PlayerFieldState }) {
  return (
    <div className={styles.playerBox} style={player.avatar ? { backgroundImage: `url(${player.avatar})` } : undefined}>
      <div className={styles.pfpWrapper}>
        <div className={styles.pfp} style={player.avatar ? { backgroundImage: `url(${player.avatar})` } : undefined}>
          {!player.avatar && initials(player.name || "?")}
        </div>
        <div className={styles.playerName}>{player.name || "PLAYER"}</div>
      </div>
    </div>
  );
}

export function ThumbnailGenerator() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<MatchCandidateOption[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, startTransition] = useTransition();

  const [player1, setPlayer1] = useState<PlayerFieldState>({ name: "", avatar: null });
  const [player2, setPlayer2] = useState<PlayerFieldState>({ name: "", avatar: null });

  const [titleLine1, setTitleLine1] = useState("");
  const [titleLine2, setTitleLine2] = useState(DEFAULT_TITLE_LINE_2);
  const [roundText, setRoundText] = useState("");
  const [channelName, setChannelName] = useState(DEFAULT_CHANNEL);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [logo, setLogo] = useState<string>(DEFAULT_LOGO);

  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const accentStyle = useMemo(() => ({ "--thumb-accent": accent }) as React.CSSProperties, [accent]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setOptions([]);
      return;
    }
    startTransition(async () => {
      setOptions(await searchMatchCandidates(value));
    });
  }

  function pickMatch(option: MatchCandidateOption) {
    setOptions([]);
    setSelectedLabel(option.label);
    setQuery("");
    startTransition(async () => {
      const data = await getMatchThumbnailData(option.id);
      if (!data) return;
      setPlayer1({ name: data.winner.name, avatar: data.winner.avatarDataUri });
      setPlayer2({ name: data.loser.name, avatar: data.loser.avatarDataUri });
      setTitleLine1(data.eventName);
      setRoundText(data.roundLabel);
    });
  }

  async function handleAvatarUpload(file: File | undefined, setPlayer: (p: PlayerFieldState) => void, current: PlayerFieldState) {
    if (!file) return;
    if (/\.(heic|heif)$/i.test(file.name)) {
      alert("iPhone HEIC photos aren't supported here — convert to JPG or PNG first.");
      return;
    }
    const dataUri = await readFileAsDataUri(file);
    setPlayer({ ...current, avatar: dataUri });
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return;
    setLogo(await readFileAsDataUri(file));
  }

  async function downloadThumbnail() {
    if (!canvasRef.current) return;
    setExporting(true);
    setExportError(null);
    try {
      const dataUrl = await htmlToImage.toJpeg(canvasRef.current, { quality: 0.95 });
      const link = document.createElement("a");
      const slug = (titleLine1 || "thumbnail").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      link.download = `${slug}-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-headline text-2xl text-ink">Thumbnail generator</h1>
        <p className="text-muted-label text-xs">Pick a match and export a 1280×720 YouTube thumbnail — nothing here is saved anywhere.</p>
      </div>

      {/* Buscador de partido */}
      <div className="rounded-lg border border-rule bg-paper p-4">
        <label className="text-eyebrow mb-2 block text-xs text-muted-label">Match</label>
        {selectedLabel ? (
          <div className="flex items-center gap-2 rounded-lg border border-rule bg-paper-tint px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{selectedLabel}</span>
            <button type="button" onClick={() => setSelectedLabel(null)} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search by player or tournament…"
              className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
            />
            {loading && <p className="text-muted-label mt-1 text-xs">Searching…</p>}
            {options.length > 0 && (
              <ul className="mt-1 overflow-hidden rounded-lg border border-rule">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => pickMatch(o)} className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-tint">
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p className="text-muted-label mt-2 text-xs">Picking a match fills in both players (winner on top) and the tournament/round below — every field stays editable.</p>
      </div>

      {/* Campos editables */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-rule bg-paper p-4 sm:grid-cols-2">
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Player 1 (top) photo</label>
          <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(e.target.files?.[0], setPlayer1, player1)} className="text-sm text-ink" />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Player 1 name</label>
          <input
            value={player1.name}
            onChange={(e) => setPlayer1({ ...player1, name: e.target.value })}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Player 2 (bottom) photo</label>
          <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(e.target.files?.[0], setPlayer2, player2)} className="text-sm text-ink" />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Player 2 name</label>
          <input
            value={player2.name}
            onChange={(e) => setPlayer2({ ...player2, name: e.target.value })}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>

        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Title line 1 (tournament)</label>
          <input
            value={titleLine1}
            onChange={(e) => setTitleLine1(e.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Title line 2 (video type)</label>
          <input
            value={titleLine2}
            onChange={(e) => setTitleLine2(e.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Round / highlight text</label>
          <input
            value={roundText}
            onChange={(e) => setRoundText(e.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Channel name</label>
          <input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-blue-500"
          />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Accent color</label>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-lg border border-rule bg-paper" />
        </div>
        <div>
          <label className="text-eyebrow mb-2 block text-xs text-muted-label">Logo (defaults to the site logo)</label>
          <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e.target.files?.[0])} className="text-sm text-ink" />
        </div>
      </div>

      {/* Vista previa — a escala para caber en el panel, pero el nodo capturado por
          html-to-image es el de tamaño real (1280x720); un transform en un ANCESTRO no
          afecta a lo exportado, solo a cómo se ve aquí en pantalla. */}
      <div className="overflow-hidden rounded-lg border border-rule" style={{ width: 640, height: 360 }}>
        <div style={{ width: 1280, height: 720, transform: "scale(0.5)", transformOrigin: "top left" }}>
          <div ref={canvasRef} className={styles.canvasArea} style={accentStyle}>
            <div className={styles.leftPanel}>
              <PlayerBox player={player1} />
              <div className={styles.dividerHorizontal} />
              <PlayerBox player={player2} />
            </div>

            <div className={styles.dividerVertical} />

            <div className={styles.rightPanel}>
              <div className={styles.rightBgPattern} />
              <div className={styles.rightBgGradient} />
              <div className={styles.rightContent}>
                <div className={styles.brandLogo}>
                  <span className={styles.logoIcon} style={{ backgroundImage: `url(${logo})` }} />
                  <span>{channelName}</span>
                </div>
                <div className={styles.titleLine}>{titleLine1 || "TOURNAMENT"}</div>
                <div className={styles.titleLine}>{titleLine2}</div>
                {roundText && <div className={styles.roundTitle}>{roundText}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={downloadThumbnail}
          disabled={exporting}
          className="text-eyebrow rounded-full bg-accent-500 px-5 py-2 text-xs text-navy-900 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Download thumbnail"}
        </button>
        {exportError && <p className="text-down text-xs">{exportError}</p>}
      </div>
    </div>
  );
}
