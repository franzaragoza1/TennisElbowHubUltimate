/**
 * Nombre de jugador tal y como se guarda: sin una etiqueta "(By …)" al final. Mana la
 * añade al nombre en algunas de sus páginas y en otras no (visto 2026-10-17: "Gyrmik
 * (By RL)"), y como cada importación copia el nombre de la página que lee, el nombre del
 * sitio iba y venía entre las dos versiones. Pedido del propietario: quitarla siempre.
 */
export function cleanPlayerName(name: string): string {
  const cleaned = name.replace(/\s*\(by\s[^()]*\)\s*$/i, "").trim();
  return cleaned || name.trim();
}
