/** Short, human label for a prompt key ("racing-v3.4" → "V3.4", "frontier-v2" → "Frontier V2"). */
export function promptLabel(key: string): string {
  if (key === 'frontier-v2') return 'Frontier V2';
  if (key === 'sun-original') return 'Original';
  const racing = /^racing-v(.+)$/.exec(key);
  if (racing) return `V${racing[1]}`;
  return key;
}
