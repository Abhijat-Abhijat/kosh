import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'axios';

import { qk } from '@/lib/query-client';
import { table } from '@/lib/db/client';
import type { Holding } from '@/types/db';
import { computedFields, todayISO } from './calc';

const http = create({ timeout: 8000 });

/** Symbol stored on gold holdings that should track the GC=F x INR=X estimate. */
export const GOLD_ESTIMATE = 'GOLD_EST';
const TROY_OZ_GRAMS = 31.1035;
const STALE_MS = 6 * 60 * 60 * 1000;

type YahooChart = {
  chart: {
    result:
      | {
          meta: { regularMarketPrice?: number };
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[]
      | null;
  };
};

async function yahoo(symbol: string, range: string, interval: string) {
  const { data } = await http.get<YahooChart>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    { params: { range, interval } },
  );
  const r = data.chart.result?.[0];
  if (!r) throw new Error(`No data for ${symbol}`);
  return r;
}

async function fetchStockPrice(symbol: string) {
  const p = (await yahoo(symbol, '1d', '1d')).meta.regularMarketPrice;
  if (typeof p !== 'number') throw new Error(`No price for ${symbol}`);
  return p;
}

async function fetchMfNav(schemeCode: string) {
  const { data } = await http.get<{ data: { nav: string }[] }>(`https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}/latest`);
  const nav = Number(data.data?.[0]?.nav);
  if (!Number.isFinite(nav)) throw new Error(`No NAV for ${schemeCode}`);
  return nav;
}

/** Estimated INR per gram: COMEX gold (USD/oz) x USD/INR / 31.1035. Not a dealer price. */
async function fetchGoldInrPerGram() {
  const [usdOz, inr] = await Promise.all([fetchStockPrice('GC=F'), fetchStockPrice('INR=X')]);
  return (usdOz * inr) / TROY_OZ_GRAMS;
}

/** ~1y of weekly closes for a sparkline. */
async function fetchHistory(h: Pick<Holding, 'kind' | 'symbol'>): Promise<number[]> {
  if (!h.symbol) return [];
  if (h.kind === 'mutual_fund') {
    // Full history, newest first; sample roughly weekly over the last year.
    const { data } = await http.get<{ data: { nav: string }[] }>(`https://api.mfapi.in/mf/${encodeURIComponent(h.symbol)}`);
    return data.data
      .slice(0, 250)
      .filter((_, i) => i % 5 === 0)
      .map((d) => Number(d.nav))
      .reverse();
  }
  const sym = h.kind === 'gold' ? 'GC=F' : h.symbol;
  const closes = (await yahoo(sym, '1y', '1wk')).indicators?.quote?.[0]?.close ?? [];
  return closes.filter((c): c is number => typeof c === 'number');
}

export function useHistory(h: Pick<Holding, 'id' | 'kind' | 'symbol'> | undefined) {
  return useQuery({
    queryKey: [...qk.holdings, h?.id, 'history'],
    queryFn: () => fetchHistory(h!),
    enabled: !!h?.symbol && (h.kind === 'stock' || h.kind === 'mutual_fund' || h.kind === 'gold'),
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });
}

/** Holdings whose price can be fetched. Gold with no symbol is a manual price. */
export const isPriced = (h: Holding) =>
  !h.closed && !!h.symbol && (h.kind === 'stock' || h.kind === 'mutual_fund' || (h.kind === 'gold' && h.symbol === GOLD_ESTIMATE));

export function pricesStale(holdings: Holding[], now = Date.now()) {
  return holdings.some(
    (h) => isPriced(h) && (!h.price_updated_at || now - new Date(h.price_updated_at).getTime() > STALE_MS),
  );
}

export type RefreshResult = { updated: number; failed: string[] };

/**
 * Fetches prices for market holdings and recomputes FD/RD/LIC cached values.
 * Failures are per-holding and non-fatal: the old price stays.
 */
async function refreshPrices(holdings: Holding[]): Promise<RefreshResult> {
  const now = new Date().toISOString();
  const asOf = todayISO();
  let gold: Promise<number> | null = null;
  const failed: string[] = [];
  let updated = 0;

  await Promise.all(
    holdings.map(async (h) => {
      if (h.closed) return;
      let patch: Partial<Holding> = {};
      if (isPriced(h)) {
        try {
          const price =
            h.kind === 'stock'
              ? await fetchStockPrice(h.symbol!)
              : h.kind === 'mutual_fund'
                ? await fetchMfNav(h.symbol!)
                : await (gold ??= fetchGoldInrPerGram());
          const value = h.units != null ? Math.round(h.units * price * 100) / 100 : h.current_value;
          patch = { current_price: Math.round(price * 10000) / 10000, current_value: value, price_updated_at: now };
        } catch {
          failed.push(h.name);
          return;
        }
      } else {
        patch = computedFields(h, asOf);
        if (!Object.keys(patch).length) return;
        if (patch.current_value === h.current_value && patch.invested_amount === h.invested_amount) return;
      }
      try {
        await table('holdings').update(h.id, patch);
        updated++;
      } catch {
        failed.push(h.name);
      }
    }),
  );
  return { updated, failed };
}

export function useRefreshPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const holdings = await table('holdings').list({ where: { closed: false } });
      return refreshPrices(holdings);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.holdings });
      qc.invalidateQueries({ queryKey: qk.summary });
    },
  });
}
