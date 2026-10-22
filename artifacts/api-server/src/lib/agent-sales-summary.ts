export type PricedSale = { currency: string; salePrice: number | null };

/** Never aggregate unlike currencies or use asking prices as sale prices. */
export function medianSalePrices(sales: PricedSale[]) {
  const groups = new Map<string, number[]>();
  for (const sale of sales) {
    const currency = sale.currency.trim().toUpperCase();
    if (!currency || sale.salePrice == null || !Number.isFinite(sale.salePrice) || sale.salePrice <= 0) continue;
    const prices = groups.get(currency) ?? [];
    prices.push(sale.salePrice);
    groups.set(currency, prices);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([currency, prices]) => {
    prices.sort((a, b) => a - b);
    const middle = Math.floor(prices.length / 2);
    const medianPrice = prices.length % 2 ? prices[middle] : prices[middle - 1] / 2 + prices[middle] / 2;
    return { currency, medianPrice, saleCount: prices.length };
  });
}

export function isPastSaleDate(value: string, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today || value < "1900-01-01") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
