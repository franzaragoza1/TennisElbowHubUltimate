/**
 * Evita dos copias del mismo script de larga duración corriendo a la vez en esta
 * máquina (bot de Discord, sincronización de marcadores en vivo, scraper) — real,
 * visto en la práctica más de una vez esta sesión: un reinicio manual que no mata la
 * copia anterior a tiempo deja dos procesos escuchando el mismo gateway de Discord /
 * escribiendo la misma fila de caché a la vez.
 *
 * Fichero de bloqueo con el PID dentro, uno por nombre de script, en `.locks/`
 * (fuera de git — es estado de ESTA máquina, no del repo). Al arrancar: si el fichero
 * existe Y el PID que contiene sigue vivo (`process.kill(pid, 0)`, que en Node
 * comprueba sin mandar ninguna señal de verdad — funciona igual en Windows), este
 * proceso se niega a arrancar. Si el PID ya no existe (el proceso murió sin limpiar —
 * crash, `taskkill /F`, `Stop-Process -Force`, todos habituales aquí) el bloqueo se
 * considera huérfano y se sustituye sin más, sin pedir permiso. Limpieza al salir de
 * forma normal (`exit`) o por señal (`SIGINT`/`SIGTERM`) — un `-Force`/`/F` no deja
 * tiempo para esto, pero no hace falta: la comprobación de PID vivo de arriba ya cubre
 * ese caso en el siguiente arranque.
 *
 * Límite conocido y aceptado a este tamaño de proyecto: si el PID se reutiliza para
 * OTRO proceso justo después de morir el original (raro, y más raro aún en la ventana
 * de segundos entre un reinicio y el siguiente arranque de este mismo script), esto
 * creería erróneamente que el bloqueo sigue vivo. No se comprueba nada más (línea de
 * comandos, hora de arranque) por no complicar esto para un riesgo tan bajo en un
 * servidor de una sola persona.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const LOCK_DIR = path.resolve(".locks");

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Llamar UNA vez, lo primero, antes de cualquier otro trabajo real del script.
 * `scriptName` identifica el bloqueo — usar el mismo nombre siempre para el mismo
 * script (p.ej. "discordBot", nunca algo que cambie entre ejecuciones). */
export function acquireSingleInstanceLock(scriptName: string): void {
  mkdirSync(LOCK_DIR, { recursive: true });
  const lockPath = path.join(LOCK_DIR, `${scriptName}.lock`);

  if (existsSync(lockPath)) {
    const existingPid = Number(readFileSync(lockPath, "utf-8").trim());
    if (Number.isInteger(existingPid) && isProcessAlive(existingPid)) {
      console.error(`✗ ${scriptName} ya está corriendo (PID ${existingPid}) — no se arranca una segunda copia.`);
      process.exit(1);
    }
  }

  writeFileSync(lockPath, String(process.pid), "utf-8");

  const releaseLock = () => {
    try {
      if (existsSync(lockPath) && Number(readFileSync(lockPath, "utf-8").trim()) === process.pid) {
        unlinkSync(lockPath);
      }
    } catch {
      // Nunca bloquear el cierre real del proceso por un fallo limpiando el lock.
    }
  };
  process.on("exit", releaseLock);
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}
