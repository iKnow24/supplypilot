/** "Weekly order" -> "Weekly order (copy)" -> "Weekly order (copy 2)" ... (max 80 chars). */
export function copyName(name: string, taken: ReadonlySet<string>): string {
  const stem = name.replace(/ \(copy(?: \d+)?\)$/, "").slice(0, 66);
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? `${stem} (copy)` : `${stem} (copy ${i})`;
    if (!taken.has(candidate)) return candidate;
  }
}
