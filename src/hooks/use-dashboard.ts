import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type DashboardSummary = {
  editionName: string;
  totalDogsSold: number;
  availableDogs: number;
  pendingDogs: number;
  totalRevenue: number;
  totalDonations: number;
  rankingSellers: { name: string; total: number }[];
};

export function useDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetch() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardSummary>('/dashboard/summary');
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetch(); }, []);

  return { data, loading, error, refresh: fetch };
}
