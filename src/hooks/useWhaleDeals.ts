import { useState, useEffect } from 'react';

export interface WhaleDeal {
  date: string;
  clientName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  securityName: string;
  exchange: string;
}

export function useWhaleDeals(scripCode?: string, ticker?: string) {
  const [deals, setDeals] = useState<WhaleDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchBulkDeals() {
      if (!scripCode && !ticker) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const query = scripCode ? `scripCode=${scripCode}` : `ticker=${ticker}`;
        const res = await fetch(`/api/bulk-deals/history?${query}&days=4745`);
        if (res.ok) {
          const json = await res.json();
          const data = json.data || [];
          
          const parsedDeals: WhaleDeal[] = data.map((d: any) => ({
            date: d.date || d.deal_date,
            clientName: d.clientName || d.client_name,
            side: (d.side || d.deal_type || '').toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
            quantity: d.quantity,
            price: d.price || d.trade_price,
            securityName: d.securityName || d.security_name,
            exchange: d.exchange || 'BSE'
          }));

          setDeals(parsedDeals);
        } else {
          throw new Error('Failed to fetch whale deals');
        }
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchBulkDeals();
  }, [scripCode, ticker]);

  return { deals, loading, error };
}
