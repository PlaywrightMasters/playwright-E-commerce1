const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats cents exactly as the shop UI does, e.g. 3028 -> "$30.28". */
export function formatMoney(cents: number): string {
  return usd.format(cents / 100);
}

/** Parses "$1,234.56" (or "-$2.50") into integer cents. */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const value = Number(cleaned);
  if (cleaned === '' || Number.isNaN(value)) throw new Error(`Not a money value: "${text}"`);
  return Math.round(value * 100);
}
