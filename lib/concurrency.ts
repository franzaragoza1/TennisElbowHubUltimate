/**
 * Cap de concurrencia genérico para tareas async independientes entre sí — pensado
 * para `neon-http` (cada consulta es una petición HTTP nueva y sin estado, ver
 * db/client.ts), donde lanzar varias en paralelo de verdad reduce la latencia total en
 * vez de arriesgar una conexión compartida. `limit` evita saturar al proveedor con
 * cientos de peticiones a la vez cuando el lote es grande.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
