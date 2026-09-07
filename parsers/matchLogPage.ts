/**
 * `MatchLog - <perfil>.NNN.html` — el histórico local de partidos de TE4 (no de Mana
 * Games). Un jugador puede subir varios ficheros numerados (001, 002...); cada uno se
 * parsea por separado con esta función.
 *
 * Solo se producen entradas `[Online]` (partido real contra otro humano, con ELO en
 * los dos lados) — todo lo demás (práctica offline, contra IA `(Incredible-N)`,
 * contra "leyendas" `[Fake] ...`) se descarta aquí mismo, antes de intentar casar
 * nombres de jugador contra la base de datos (`lib/matchLog/linkToTourMatch.ts` hace
 * eso a partir de lo que esta función deje pasar). Es el filtro que separa "podría
 * ser un partido real del tour" de "seguro que no lo es".
 */
import * as cheerio from "cheerio";
import {
  MatchLogPageSchema,
  type ParsedMatchLogPage,
  type ParsedMatchLogEntry,
  type ParsedMatchLogPlayerStats,
  type ParsedSet,
} from "./schemas";

export interface SkippedMatchLogEntry {
  raw: string;
  reason: string;
}

export interface MatchLogParseResult {
  page: ParsedMatchLogPage;
  skipped: SkippedMatchLogEntry[];
}

const MPH_TO_KMH = 1.60934;
const ONLINE_TAG = "[Online]";

function parseSpeedCell(text: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*(Km\/h|Mph)$/i.exec(text.trim());
  if (!m) return null;
  const value = Number(m[1]);
  if (Number.isNaN(value)) return null;
  return Math.round(m[2].toLowerCase() === "mph" ? value * MPH_TO_KMH : value);
}

function parseFraction(text: string): { num: number; den: number } | null {
  // "24 / 43 = 56%"
  const m = /^(\d+)\s*\/\s*(\d+)\s*=/.exec(text.trim());
  if (!m) return null;
  return { num: Number(m[1]), den: Number(m[2]) };
}

function parseSingleInt(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

type StatField = keyof ParsedMatchLogPlayerStats;

// Etiquetas tal como aparecen en la celda `c1`/`c2` de la fuente, normalizadas a
// mayúsculas para no depender de mayúsculas/minúsculas exactas del fichero. El cliente
// de TE4 escribe estas filas en el idioma que tenga configurado quien jugó — cada
// bloque de variantes de abajo está verificado contra HTML real ya subido (2026-09-07,
// ver docs/decisiones.md), nunca traducido a mano: nunca se quita una clave existente,
// solo se añaden alias que apuntan al mismo campo, así que un idioma nuevo no puede
// romper uno que ya funcionaba.
const FRACTION_FIELDS: Record<string, [num: StatField, den: StatField]> = {
  "1ST SERVE %": ["firstServeIn", "firstServeAttempted"],
  "1ST SERVE WON %": ["firstServePointsWon", "firstServePointsPlayed"],
  "2ND SERVE WON %": ["secondServePointsWon", "secondServePointsPlayed"],
  "RETURN POINTS WON": ["returnPointsWon", "returnPointsPlayed"],
  "NET POINTS WON": ["netPointsWon", "netPointsPlayed"],
  "BREAK POINTS WON": ["breakPointsWon", "breakPointsFaced"],
  // Inglés de una build más antigua del cliente (fichero real de 2022-2023): mismas
  // cinco filas, redacción distinta — sin esto, netPointsWon/breakPointsWon se
  // quedaban en null para todo fichero de esa época, en cualquier idioma.
  "1ST SERVE": ["firstServeIn", "firstServeAttempted"],
  "POINTS WON ON 1ST SERVE": ["firstServePointsWon", "firstServePointsPlayed"],
  "POINTS WON ON 2ND SERVE": ["secondServePointsWon", "secondServePointsPlayed"],
  "NET APPROACHES": ["netPointsWon", "netPointsPlayed"],
  "BREAK POINT CONVERSIONS": ["breakPointsWon", "breakPointsFaced"],
  // Francés:
  "1ER SERVICE": ["firstServeIn", "firstServeAttempted"],
  "POINTS GAGNÉS SUR 1ER SERVICE": ["firstServePointsWon", "firstServePointsPlayed"],
  "POINTS GAGNÉS SUR 2ND SERVICE": ["secondServePointsWon", "secondServePointsPlayed"],
  "POINTS GAGNÉS SUR LE RETOUR": ["returnPointsWon", "returnPointsPlayed"],
  "MONTÉES AU FILET": ["netPointsWon", "netPointsPlayed"],
  // "Break Point Conversions" no se traduce en el cliente francés — ya cubierto arriba.
  // Resto de idiomas verificados contra un fichero de ejemplo con un partido por
  // idioma (2026-09-07) — cuando una fila cae en inglés en ese fichero para un idioma
  // dado (hueco real de localización del propio juego), no hace falta clave nueva: ya
  // la cubren las claves en inglés de arriba.
  // Español:
  "PRIMEROS SERVICIOS": ["firstServeIn", "firstServeAttempted"],
  "PUNTOS GANADOS EN EL 1° SERVICIO": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNTOS GANADOS EN EL 2° SERVICIO": ["secondServePointsWon", "secondServePointsPlayed"],
  "PUNTOS GANADOS SOBRE LA DEVOLUCIÓN": ["returnPointsWon", "returnPointsPlayed"],
  "PUNTOS EN LA RED": ["netPointsWon", "netPointsPlayed"],
  "PUNTOS DE QUIEBRE APROVECHADOS": ["breakPointsWon", "breakPointsFaced"],
  // Húngaro:
  "1. ADOGATÁS": ["firstServeIn", "firstServeAttempted"],
  "1. ADOGATÁSBÓL NYERT PONTOK": ["firstServePointsWon", "firstServePointsPlayed"],
  "2. ADOGATÁSBÓL NYERT PONTOK": ["secondServePointsWon", "secondServePointsPlayed"],
  "JELENLÉT A HÁLÓNÁL": ["netPointsWon", "netPointsPlayed"],
  "BRÉKPONT KIHASZNÁLÁS": ["breakPointsWon", "breakPointsFaced"],
  // Neerlandés:
  "1E OPSLAG": ["firstServeIn", "firstServeAttempted"],
  "PUNTEN GEWONNEN OP 1E OPSLAG": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNTEN GEWONNEN OP 2DE OPSLAG": ["secondServePointsWon", "secondServePointsPlayed"],
  "NETBENADERINGEN": ["netPointsWon", "netPointsPlayed"],
  "BENUTTE BREEKPUNTEN": ["breakPointsWon", "breakPointsFaced"],
  // Polaco:
  "PIERWSZY SERWIS": ["firstServeIn", "firstServeAttempted"],
  "PUNKTY Z PIERWSZEGO SERWISU": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNKTY Z DRUGIEGO SERWISU": ["secondServePointsWon", "secondServePointsPlayed"],
  "PODEJŚCIA DO SIATKI": ["netPointsWon", "netPointsPlayed"],
  "PRZEŁAMANIA": ["breakPointsWon", "breakPointsFaced"],
  // Portugués:
  "1° SERVIÇO": ["firstServeIn", "firstServeAttempted"],
  "PONTOS CONQUISTADOS NO 1° SERVIÇO": ["firstServePointsWon", "firstServePointsPlayed"],
  "PONTOS CONQUISTADOS NO 2° SERVIÇO": ["secondServePointsWon", "secondServePointsPlayed"],
  "PONTOS CONQUISTADOS NA DEVOLUÇÃO": ["returnPointsWon", "returnPointsPlayed"],
  "APROXIMAÇÕES DA REDE": ["netPointsWon", "netPointsPlayed"],
  "CONVERSÕES DE BREAK POINT": ["breakPointsWon", "breakPointsFaced"],
  // Rumano:
  "PRIMUL SERVICIU": ["firstServeIn", "firstServeAttempted"],
  "PUNCTE CÂȘTIGATE PE PRIMUL SERVICIU": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNCTE CÂȘTIGATE PE AL DOILEA SERVICIU": ["secondServePointsWon", "secondServePointsPlayed"],
  "PUNCTE CÂȘTIGATE PE RETUR": ["returnPointsWon", "returnPointsPlayed"],
  "URCĂRI LA FILEU": ["netPointsWon", "netPointsPlayed"],
  "MINGI DE BREAK FRUCTIFICATE": ["breakPointsWon", "breakPointsFaced"],
  // Serbocroata:
  "PRVI SERVIS": ["firstServeIn", "firstServeAttempted"],
  "POENI OSVOJENI NAKON PRVOG SERVISA": ["firstServePointsWon", "firstServePointsPlayed"],
  "POENI OSVOJENI NAKON DRUGOG SERIVSA": ["secondServePointsWon", "secondServePointsPlayed"],
  "IZLASCI NA MREŽE": ["netPointsWon", "netPointsPlayed"],
  "PRILIKE ZA BREJK": ["breakPointsWon", "breakPointsFaced"],
  "PRILIKE ZA OBRAT": ["breakPointsWon", "breakPointsFaced"],
  // Eslovaco:
  "PRVÉ PODANIE": ["firstServeIn", "firstServeAttempted"],
  "BODY VYHRANÉ PO PRVOM PODANÍ": ["firstServePointsWon", "firstServePointsPlayed"],
  "BODY VYHRANÉ PO DRUHOM PODANÍ": ["secondServePointsWon", "secondServePointsPlayed"],
  "BODY VYHRATÉ NA RITERNE": ["returnPointsWon", "returnPointsPlayed"],
  "ÚSPEŠNOST NA SIETI": ["netPointsWon", "netPointsPlayed"],
  "PREMIENANIE BREJKBALOV": ["breakPointsWon", "breakPointsFaced"],
  // Checo:
  "1. PODÁNÍ": ["firstServeIn", "firstServeAttempted"],
  "BODY ZÍSKANÉ PŘI 1. PODÁNÍ": ["firstServePointsWon", "firstServePointsPlayed"],
  "BODY ZÍSKANÉ PŘI 2. PODÁNÍ": ["secondServePointsWon", "secondServePointsPlayed"],
  "VYHRANÉ BODY PŘI PŘÍJMU": ["returnPointsWon", "returnPointsPlayed"],
  "ÚSPĚŠNOST NA SÍTI": ["netPointsWon", "netPointsPlayed"],
  "ÚSPĚŠNOST BREJKBOLŮ": ["breakPointsWon", "breakPointsFaced"],
  // Alemán:
  "1. AUFSCHLAG": ["firstServeIn", "firstServeAttempted"],
  "PUNKTGEWINN MIT 1. AUFSCHLAG": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNKTGEWINN MIT 2. AUFSCHLAG": ["secondServePointsWon", "secondServePointsPlayed"],
  "RÜCKSCHLÄGE GEWONNEN": ["returnPointsWon", "returnPointsPlayed"],
  "NETZANGRIFFE": ["netPointsWon", "netPointsPlayed"],
  "BREAK POINT VERWERTUNG": ["breakPointsWon", "breakPointsFaced"],
  // Italiano:
  "1° DI SERVIZIO": ["firstServeIn", "firstServeAttempted"],
  "PUNTI VINTI SU 1° DI SERVIZIO": ["firstServePointsWon", "firstServePointsPlayed"],
  "PUNTI VINTI SU 2° DI SERVIZIO": ["secondServePointsWon", "secondServePointsPlayed"],
  "PUNTI VINTI IN RISPOSTA": ["returnPointsWon", "returnPointsPlayed"],
  "DISCESE A RETE": ["netPointsWon", "netPointsPlayed"],
  "BREAK POINT CONVERTITI": ["breakPointsWon", "breakPointsFaced"],
  // Ruso:
  "1 ПОДАЧА": ["firstServeIn", "firstServeAttempted"],
  "ОЧКОВ ВЫИГРАНО НА 1 ПОДАЧЕ": ["firstServePointsWon", "firstServePointsPlayed"],
  "ОЧКОВ ВЫИГРАНО НА 2 ПОДАЧЕ": ["secondServePointsWon", "secondServePointsPlayed"],
  "ВЫИГРАНО ОЧКОВ НА ПРИЁМЕ": ["returnPointsWon", "returnPointsPlayed"],
  "ВЫХОДЫ К СЕТКЕ": ["netPointsWon", "netPointsPlayed"],
  "РЕАЛИЗАЦИЯ БРЕЙК-ПОИНТОВ": ["breakPointsWon", "breakPointsFaced"],
  // Chino simplificado:
  "一发进球率": ["firstServeIn", "firstServeAttempted"],
  "一发得分率": ["firstServePointsWon", "firstServePointsPlayed"],
  "二发得分率": ["secondServePointsWon", "secondServePointsPlayed"],
  "接发球得分率": ["returnPointsWon", "returnPointsPlayed"],
  "网前得分率": ["netPointsWon", "netPointsPlayed"],
  "破发点转换率": ["breakPointsWon", "breakPointsFaced"],
  // Chino tradicional:
  "一發": ["firstServeIn", "firstServeAttempted"],
  "一發得分率": ["firstServePointsWon", "firstServePointsPlayed"],
  "二發得分率": ["secondServePointsWon", "secondServePointsPlayed"],
  "接發球得分率": ["returnPointsWon", "returnPointsPlayed"],
  "網前得分率": ["netPointsWon", "netPointsPlayed"],
  "破發點轉換率": ["breakPointsWon", "breakPointsFaced"],
  // Coreano:
  "첫 서브": ["firstServeIn", "firstServeAttempted"],
  "첫 서브에서 획득한 포인트": ["firstServePointsWon", "firstServePointsPlayed"],
  "세컨드 서브에서 획득한 포인트": ["secondServePointsWon", "secondServePointsPlayed"],
  "리턴득점": ["returnPointsWon", "returnPointsPlayed"],
  "네트 어프로치": ["netPointsWon", "netPointsPlayed"],
  "브레이크 포인트 확율": ["breakPointsWon", "breakPointsFaced"],
  // Japonés:
  "1STサーブ": ["firstServeIn", "firstServeAttempted"],
  "ファーストサーブで獲得したポイント": ["firstServePointsWon", "firstServePointsPlayed"],
  "セカンドサーブで獲得したポイント": ["secondServePointsWon", "secondServePointsPlayed"],
  "リターンポイント獲得数": ["returnPointsWon", "returnPointsPlayed"],
  "ネットアプローチ": ["netPointsWon", "netPointsPlayed"],
  "ブレークポイント成功率": ["breakPointsWon", "breakPointsFaced"],
};

const SINGLE_INT_FIELDS: Record<string, StatField> = {
  ACES: "aces",
  "DOUBLE FAULTS": "doubleFaults",
  WINNERS: "winners",
  "FORCED ERRORS": "forcedErrors",
  "UNFORCED ERRORS": "unforcedErrors",
  "TOTAL POINTS WON": "totalPointsWon",
  // Francés:
  "DOUBLES FAUTES": "doubleFaults",
  "POINTS GAGNANTS": "winners",
  "FAUTES PROVOQUÉES": "forcedErrors",
  "FAUTES DIRECTES": "unforcedErrors",
  "TOTAL DES POINTS GAGNÉS": "totalPointsWon",
  // "Aces" no se traduce en francés — ya cubierto arriba.
  // Resto de idiomas verificados contra un fichero de ejemplo con un partido por
  // idioma (2026-09-07) — "ACES"/"WINNERS" en mayúsculas ya casan sin clave nueva
  // cuando el juego deja esa fila sin traducir para un idioma dado.
  // Español:
  "DOBLE FALTAS": "doubleFaults",
  "TIROS GANADORES": "winners",
  "ERRORES FORZADOS": "forcedErrors",
  "ERRORES NO FORZADOS": "unforcedErrors",
  "TOTAL DE PUNTOS GANADOS": "totalPointsWon",
  // Húngaro:
  "ÁSZOK": "aces",
  "KETTŐS HIBÁK": "doubleFaults",
  "KETTÕS HIBÁK": "doubleFaults", // variante de codificación vista en datos reales
  "NYERŐK": "winners",
  "NYERÕK": "winners",
  "ÖSSZES MEGNYERT PONT": "totalPointsWon",
  // Neerlandés:
  "DUBBELE FOUTEN": "doubleFaults",
  "TOTAAL GEWONNEN PUNTEN": "totalPointsWon",
  // "Winners" no se traduce en neerlandés — ya cubierto arriba.
  // Polaco:
  "ASY": "aces",
  "PODWÓJNE BŁĘDY": "doubleFaults",
  "UDERZENIA WYGRYWAJĄCE": "winners",
  "UDERZENIA WYGRYWAJŠCE": "winners", // acento roto visto en datos reales
  "SUMA ZDOBYTYCH PUNKTÓW": "totalPointsWon",
  // Portugués:
  "DUPLAS FALTAS": "doubleFaults",
  "ERROS FORÇADOS": "forcedErrors",
  "ERROS NÃO FORÇADOS": "unforcedErrors",
  "TOTAL DE PONTOS CONQUISTADOS": "totalPointsWon",
  // "Aces"/"Winners" no se traducen en portugués — ya cubiertos arriba.
  // Rumano:
  "AȘI": "aces",
  "DUBLE GREȘELI": "doubleFaults",
  "LOVITURI CÂȘTIGĂTOARE": "winners",
  "ERORI FORȚATE": "forcedErrors",
  "ERORI NEFORȚATE": "unforcedErrors",
  "NUMĂR TOTAL DE PUNCTE CÂȘTIGATE": "totalPointsWon",
  // Serbocroata:
  "ASEVI": "aces",
  "DVOSTURKE GREŠKE": "doubleFaults",
  "DVOSTURKE POGREŠKE": "doubleFaults",
  "DIREKTNI POENI": "winners",
  "UKUPNO POENA": "totalPointsWon",
  // Eslovaco:
  "ESÁ": "aces",
  "DVOJCHYBY": "doubleFaults",
  "VÍTAZNÉ ÚDERY": "winners",
  "CELKOVÝ POCET VYHRANÝCH BODOV": "totalPointsWon",
  // Checo:
  "ESO": "aces",
  "DVOJCHYBA": "doubleFaults",
  "VÍTĚZNÉ": "winners",
  "VYNUCENÉ CHYBY": "forcedErrors",
  "NEVYNUCENÉ CHYBY": "unforcedErrors",
  "CELKOVÝ POČET ZÍSKANÝCH BODŮ": "totalPointsWon",
  // Alemán:
  "ASSE": "aces",
  "DOPPELFEHLER": "doubleFaults",
  WINNER: "winners", // singular, distinto de "WINNERS" (inglés/neerlandés/portugués)
  "ERZWUNGENE FEHLER": "forcedErrors",
  "UNERZWUNGENE FEHLER": "unforcedErrors",
  "GESAMTPUNKTE GEWONNEN": "totalPointsWon",
  // Italiano:
  ACE: "aces", // singular, distinto de "ACES"
  "DOPPI FALLI": "doubleFaults",
  VINCENTI: "winners",
  "ERRORI FORZATI": "forcedErrors",
  "ERRORI DIRETTI": "unforcedErrors",
  "TOTALE PUNTI": "totalPointsWon",
  // Ruso:
  ЭЙСЫ: "aces",
  "ДВОЙНЫЕ ОШИБКИ": "doubleFaults",
  ВИННЕРЫ: "winners",
  "ВЫНУЖДЕННЫЕ ОШИБКИ": "forcedErrors",
  "НЕВЫНУЖДЕННЫЕ ОШИБКИ": "unforcedErrors",
  "ВСЕГО ОЧКОВ ВЫИГРАНО": "totalPointsWon",
  // Chino simplificado:
  双误: "doubleFaults",
  制胜分: "winners",
  受迫性失误: "forcedErrors",
  非受迫性失误: "unforcedErrors",
  总分: "totalPointsWon",
  // Chino tradicional:
  雙誤: "doubleFaults",
  制勝分: "winners",
  受迫性失誤: "forcedErrors",
  非受迫性失誤: "unforcedErrors",
  總得分: "totalPointsWon",
  // Coreano:
  에이스: "aces",
  "더블 폴트": "doubleFaults",
  위너: "winners",
  "포스드 에러": "forcedErrors",
  "언포스드 에러": "unforcedErrors",
  "총 획득 포인트": "totalPointsWon",
  // Japonés:
  エース: "aces",
  ダブルフォルト: "doubleFaults",
  ウィナー: "winners",
  フォーストエラー: "forcedErrors",
  アンフォーストエラー: "unforcedErrors",
  総得点: "totalPointsWon",
};

const SPEED_FIELDS: Record<string, StatField> = {
  "FASTEST SERVE": "fastestServeKmh",
  "AVG 1ST SERVE SPEED": "avgFirstServeSpeedKmh",
  "AVG 2ND SERVE SPEED": "avgSecondServeSpeedKmh",
  // Francés:
  "SERVICE LE PLUS RAPIDE": "fastestServeKmh",
  "VITESSE MOYENNE DU 1ER SERVICE": "avgFirstServeSpeedKmh",
  "VITESSE MOYENNE DU 2ND SERVICE": "avgSecondServeSpeedKmh",
  // Resto de idiomas verificados contra un fichero de ejemplo con un partido por
  // idioma (2026-09-07) — cuando el juego deja esta fila en inglés para un idioma
  // dado, ya la cubren las claves en inglés de arriba (el `.toUpperCase()` de
  // `applyRow` iguala "AVG 1st SERVE SPEED" con "AVG 1ST SERVE SPEED").
  // Español:
  "SERVICIO MÁS RÁPIDO": "fastestServeKmh",
  "PROMEDIO DE VELOCIDAD DEL 1° SAQUE": "avgFirstServeSpeedKmh",
  "PROMEDIO DE VELOCIDAD DEL 2° SAQUE": "avgSecondServeSpeedKmh",
  // Húngaro:
  "LEGGYORSABB ADOGATÁS": "fastestServeKmh",
  "ÁTLAG 1. ADOGATÁS SEBESSÉG": "avgFirstServeSpeedKmh",
  "ÁTLAG 2. ADOGATÁS SEBESSÉG": "avgSecondServeSpeedKmh",
  // Neerlandés:
  "SNELSTE OPSLAG": "fastestServeKmh",
  "GEM SNELHEID 1E OPSLAG": "avgFirstServeSpeedKmh",
  "GEM SNELHEID 2E OPSLAG": "avgSecondServeSpeedKmh",
  // Portugués:
  "SERVIÇO MAIS RÁPIDO": "fastestServeKmh",
  "MÉDIA DE VELOCIDADE DO 1° SERVIÇO": "avgFirstServeSpeedKmh",
  "MÉDIA DE VELOCIDADE DO 2° SERVIÇO": "avgSecondServeSpeedKmh",
  // Rumano:
  "CEL MAI RAPID SERVICIU": "fastestServeKmh",
  "VITEZA MEDIE A PRIMULUI SERVICIU": "avgFirstServeSpeedKmh",
  "VITEZA MEDIA A CELUI DE-AL DOILEA SERVICIU": "avgSecondServeSpeedKmh",
  // Eslovaco:
  "NAJRÝCHLEJŠIE PODANIE": "fastestServeKmh",
  "PRIEMERNÁ RÝCHLOST PRVÉHO PODANIA": "avgFirstServeSpeedKmh",
  "PRIEMERNÁ RÝCHLOST DRUHÉHO PODANIA": "avgSecondServeSpeedKmh",
  // Checo:
  "NEJRYCHLEJŠÍ PODÁNÍ": "fastestServeKmh",
  "PRŮM. RYCHLOST 1. PODÁNÍ": "avgFirstServeSpeedKmh",
  "PRŮM. RYCHLOST 2. PODÁNÍ": "avgSecondServeSpeedKmh",
  // Alemán:
  "SCHNELLSTER AUFSCHLAG": "fastestServeKmh",
  "DURCHSCHNITTLICHER 1.AUFSCHLAG": "avgFirstServeSpeedKmh",
  "DURCHSCHNITTLICHER 2.AUFSCHLAG": "avgSecondServeSpeedKmh",
  // Italiano:
  "SERVIZIO PIÙ VELOCE": "fastestServeKmh",
  "1° SERVIZIO VELOCITÀ MEDIA": "avgFirstServeSpeedKmh",
  "2° SERVIZIO VELOCITÀ MEDIA": "avgSecondServeSpeedKmh",
  // Ruso:
  "САМАЯ БЫСТРАЯ ПОДАЧА": "fastestServeKmh",
  "СРЕДНЯЯ СКОРОСТЬ 1 ПОДАЧИ": "avgFirstServeSpeedKmh",
  "СРЕДНЯЯ СКОРОСТЬ 2 ПОДАЧИ": "avgSecondServeSpeedKmh",
  // Chino simplificado:
  最快发球速度: "fastestServeKmh",
  一发平均速度: "avgFirstServeSpeedKmh",
  二发平均速度: "avgSecondServeSpeedKmh",
  // Chino tradicional:
  最快發球時速: "fastestServeKmh",
  平均一發球速度: "avgFirstServeSpeedKmh",
  平均二發球速度: "avgSecondServeSpeedKmh",
  // Coreano:
  "가장 빠른 서브": "fastestServeKmh",
  "평균 첫 서브 속도": "avgFirstServeSpeedKmh",
  "평균 세컨드 서브 속도": "avgSecondServeSpeedKmh",
  // Japonés:
  最速サーブ: "fastestServeKmh",
  ファーストサーブ平均速度: "avgFirstServeSpeedKmh",
  セカンドサーブ平均速度: "avgSecondServeSpeedKmh",
};

// Filas que existen en el fichero fuente pero que esta primera versión no guarda
// (rachas de peloteo, puntos de set/partido salvados, ganadores de resto, breaks por
// juego) se ignoran sin más: ninguna etiqueta desconocida rompe el parseo.

function emptyStats(): ParsedMatchLogPlayerStats {
  return {
    aces: null,
    doubleFaults: null,
    firstServeAttempted: null,
    firstServeIn: null,
    firstServePointsPlayed: null,
    firstServePointsWon: null,
    secondServePointsPlayed: null,
    secondServePointsWon: null,
    breakPointsFaced: null,
    breakPointsWon: null,
    returnPointsPlayed: null,
    returnPointsWon: null,
    netPointsPlayed: null,
    netPointsWon: null,
    winners: null,
    forcedErrors: null,
    unforcedErrors: null,
    totalPointsWon: null,
    fastestServeKmh: null,
    avgFirstServeSpeedKmh: null,
    avgSecondServeSpeedKmh: null,
  };
}

function applyRow(
  p1Text: string,
  label: string,
  p2Text: string,
  p1: ParsedMatchLogPlayerStats,
  p2: ParsedMatchLogPlayerStats,
): void {
  const key = label.trim().toUpperCase();

  const fraction = FRACTION_FIELDS[key];
  if (fraction) {
    const [numField, denField] = fraction;
    const f1 = parseFraction(p1Text);
    const f2 = parseFraction(p2Text);
    if (f1) {
      p1[numField] = f1.num;
      p1[denField] = f1.den;
    }
    if (f2) {
      p2[numField] = f2.num;
      p2[denField] = f2.den;
    }
    return;
  }

  const single = SINGLE_INT_FIELDS[key];
  if (single) {
    const v1 = parseSingleInt(p1Text);
    const v2 = parseSingleInt(p2Text);
    if (v1 !== null) p1[single] = v1;
    if (v2 !== null) p2[single] = v2;
    return;
  }

  const speed = SPEED_FIELDS[key];
  if (speed) {
    const v1 = parseSpeedCell(p1Text);
    const v2 = parseSpeedCell(p2Text);
    if (v1 !== null) p1[speed] = v1;
    if (v2 !== null) p2[speed] = v2;
  }
}

interface HeaderInfo {
  player1Name: string;
  player2Name: string;
  scoreRaw: string;
  playedAt: Date;
  /** `true` cuando el separador encontrado no garantiza que `player1Name` sea el
   * ganador (ver `SEPARATORS` más abajo) — quien casa esto contra el tour
   * (lib/matchLog/linkToTourMatch.ts) tiene que probar las dos combinaciones en vez de
   * asumir que el de la izquierda ganó. */
  winnerOrderAmbiguous: boolean;
}

type ParseOutcome<T> = T | { error: string };

// El cliente de TE4 escribe "quién le ganó a quién" distinto según su idioma —
// verificado contra ficheros reales ya subidos y contra un fichero de ejemplo con un
// partido por idioma (2026-09-07, ver docs/decisiones.md). Todos ponen SIEMPRE al
// ganador a la izquierda, igual que el inglés de toda la vida — EXCEPTO " vs " y el
// guion suelto " - " (serbocroata), vistos en datos reales tanto con el ganador a la
// izquierda como a la derecha: de ahí `winnerFirst: false` para esos dos, que obliga a
// quien casa el partido (lib/matchLog/linkToTourMatch.ts) a probar las dos
// combinaciones contra los partidos reales del tour en vez de adivinar por posición.
const SEPARATORS: { token: string; winnerFirst: boolean }[] = [
  { token: " def. ", winnerFirst: true }, // inglés
  { token: " bat. ", winnerFirst: true }, // francés
  { token: " Przegrana ", winnerFirst: true }, // polaco
  { token: " veri ", winnerFirst: true }, // húngaro
  { token: " der. ", winnerFirst: true }, // portugués
  { token: " por. ", winnerFirst: true }, // checo
  { token: " b. ", winnerFirst: true }, // italiano
  { token: " победил ", winnerFirst: true }, // ruso
  { token: " vs ", winnerFirst: false },
  { token: " - ", winnerFirst: false }, // serbocroata
];

/**
 * El separador real SIEMPRE va DESPUÉS de cerrarse el paréntesis de detalle del
 * jugador 1 (rank/ELO/personaje, p.ej. "(#105 - Profesionalac-10 90.6%)") — ese mismo
 * paréntesis puede contener un guion suelto ("#105 - Profesionalac-10"), así que
 * buscar desde el principio del texto encontraría ESE guion en vez del separador real
 * en cuanto el separador es él mismo un guion suelto (serbocroata). Se busca la
 * ocurrencia MÁS TEMPRANA de cualquier separador conocido dentro de esa zona segura,
 * nunca el primero de la lista que aparezca en cualquier sitio del texto.
 */
function findSeparator(text: string): { token: string; index: number; winnerFirst: boolean } | null {
  const searchStart = text.indexOf(")") + 1;
  if (searchStart <= 0) return null;
  const searchArea = text.slice(searchStart);

  let best: { token: string; relativeIndex: number; winnerFirst: boolean } | null = null;
  for (const { token, winnerFirst } of SEPARATORS) {
    const idx = searchArea.indexOf(token);
    if (idx !== -1 && (best === null || idx < best.relativeIndex)) {
      best = { token, relativeIndex: idx, winnerFirst };
    }
  }
  return best ? { token: best.token, index: searchStart + best.relativeIndex, winnerFirst: best.winnerFirst } : null;
}

function splitNameAndDetail(text: string): { name: string; detail: string | null } {
  const trimmed = text.trim();
  if (trimmed.endsWith(")")) {
    const openIdx = trimmed.lastIndexOf("(");
    if (openIdx > 0) {
      return { name: trimmed.slice(0, openIdx).trim(), detail: trimmed.slice(openIdx + 1, -1).trim() };
    }
  }
  return { name: trimmed, detail: null };
}

function parseHeader(rawText: string): ParseOutcome<HeaderInfo> {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text.endsWith(ONLINE_TAG)) return { error: "not an online match" };
  const withoutTag = text.slice(0, -ONLINE_TAG.length).trim();

  const sep = findSeparator(withoutTag);
  if (!sep) return { error: "missing a recognized winner separator (def./bat./Przegrana/vs)" };
  const leftRaw = withoutTag.slice(0, sep.index);
  const afterSep = withoutTag.slice(sep.index + sep.token.length);

  const colonIdx = afterSep.indexOf(" : ");
  if (colonIdx === -1) return { error: "missing ' : ' separator" };
  const rightRaw = afterSep.slice(0, colonIdx);
  const tailRaw = afterSep.slice(colonIdx + " : ".length);

  const { name: player1Name, detail: detail1 } = splitNameAndDetail(leftRaw);
  const { name: player2Name, detail: detail2 } = splitNameAndDetail(rightRaw);
  if (!detail1 || !detail2) return { error: "online match missing player detail" };
  if (!player1Name || !player2Name) return { error: "empty player name" };

  const parts = tailRaw.split(" - ");
  if (parts.length < 4) return { error: "unexpected tail shape" };
  const scoreRaw = parts[0];
  const dateTimeRaw = parts[parts.length - 1];

  // El `(?:\s*\(.*\))?` final tolera una anotación de temporada/semana en modo
  // carrera detrás de la hora (p.ej. "(2021 ; Week 3)", "(2021 ; Semana 3)") — un
  // partido real `[Online]` nunca la trae, pero da igual: si no está, el grupo
  // simplemente no casa con nada y el resto sigue igual.
  const dtMatch = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s*\(.*\))?$/.exec(dateTimeRaw.trim());
  if (!dtMatch) return { error: "unparseable date/time" };
  const playedAt = new Date(`${dtMatch[1]}T${dtMatch[2]}:00`);
  if (Number.isNaN(playedAt.getTime())) return { error: "invalid date" };

  return { player1Name, player2Name, scoreRaw, playedAt, winnerOrderAmbiguous: !sep.winnerFirst };
}

interface ScoreInfo {
  sets: ParsedSet[];
  outcome: "played" | "retired";
}

function parseScore(scoreRaw: string): ParseOutcome<ScoreInfo> {
  const tokens = scoreRaw.trim().split(/\s+/);
  let outcome: "played" | "retired" = "played";
  let setTokens = tokens;
  // "ret." (inglés) / "zak." (polaco, "zakończony" — visto en datos reales junto a un
  // marcador incompleto tipo "5/5", mismo patrón estructural que "ret."). Se añade
  // aquí, no se adivina para otros idiomas sin haber visto el token real.
  const last = tokens[tokens.length - 1];
  if (last && /^(ret\.?|zak\.?)$/i.test(last)) {
    outcome = "retired";
    setTokens = tokens.slice(0, -1);
  }
  if (setTokens.length === 0) return { error: "no sets in score" };

  const sets: ParsedSet[] = [];
  for (let i = 0; i < setTokens.length; i++) {
    const m = /^(\d+)\/(\d+)(?:\((\d+)\))?$/.exec(setTokens[i]);
    if (!m) return { error: `unparseable set token "${setTokens[i]}"` };
    // El primer número de cada set es SIEMPRE el del ganador del partido (player1,
    // "X def. Y"), aunque haya perdido ese set concreto — NUNCA Math.max/min: eso
    // asume que el ganador del partido gana todos sus sets, y lo desordena justo en el
    // set que de verdad importa (uno perdido en la muerte súbita, p.ej. "6/7(7)" real,
    // donde el ganador del partido se quedó con 6 games). Mismo criterio que ya usa
    // `sets`/`scoreRaw` en el resto de la web — ver lib/matchScore.ts.
    sets.push({
      setNumber: i + 1,
      winnerGames: Number(m[1]),
      loserGames: Number(m[2]),
      tiebreakLoserPoints: m[3] !== undefined ? Number(m[3]) : null,
    });
  }
  return { sets, outcome };
}

export function parseMatchLogPage(html: string): MatchLogParseResult {
  const $ = cheerio.load(html);
  const entries: ParsedMatchLogEntry[] = [];
  const skipped: SkippedMatchLogEntry[] = [];

  $("table[id]").each((_, table) => {
    const $table = $(table);
    const header = $table.prev("p").text();

    const headerResult = parseHeader(header);
    if ("error" in headerResult) {
      // "not an online match" es, con muchísima diferencia, el caso normal (práctica,
      // partidos contra IA) — no merece la pena registrarlo como si fuera un fallo.
      if (headerResult.error !== "not an online match") {
        skipped.push({ raw: header.trim(), reason: headerResult.error });
      }
      return;
    }

    const scoreResult = parseScore(headerResult.scoreRaw);
    if ("error" in scoreResult) {
      skipped.push({ raw: header.trim(), reason: scoreResult.error });
      return;
    }

    const player1Stats = emptyStats();
    const player2Stats = emptyStats();
    $table.find("tr").each((__, tr) => {
      const tds = $(tr)
        .find("td")
        .map((___, td) => $(td).text())
        .get();
      if (tds.length === 7) {
        applyRow(tds[0], tds[1], tds[2], player1Stats, player2Stats);
        applyRow(tds[4], tds[5], tds[6], player1Stats, player2Stats);
      } else if (tds.length === 3) {
        applyRow(tds[0], tds[1], tds[2], player1Stats, player2Stats);
      }
    });

    entries.push({
      player1Name: headerResult.player1Name,
      player2Name: headerResult.player2Name,
      outcome: scoreResult.outcome,
      sets: scoreResult.sets,
      playedAt: headerResult.playedAt,
      player1Stats,
      player2Stats,
      winnerOrderAmbiguous: headerResult.winnerOrderAmbiguous,
    });
  });

  return { page: MatchLogPageSchema.parse({ entries }), skipped };
}
