import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type DonationOrder = {
  id: string; customerName: string; totalValue: number;
  paymentStatus: string; observations: string; createdAt: string;
  items: { id: string }[]; partner?: { name: string };
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function DonationsScreen() {
  const t = useTheme().colors;
  const [orders, setOrders] = useState<DonationOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ data: DonationOrder[] }>('/orders/donations-analysis?limit=100');
      setOrders(Array.isArray(res?.data) ? res.data : []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const totalDogs = orders.reduce((acc, o) => acc + (o.items?.length ?? 0), 0);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Doações" />

      <View style={s.summary}>
        {[
          { num: orders.length, label: 'Pedidos' },
          { num: totalDogs, label: 'Dogões' },
        ].map(({ num, label }) => (
          <View key={label} style={[s.summaryCard, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
            <Text style={[s.summaryNum, { color: t.textBrand }]}>{num}</Text>
            <Text style={[s.summaryLabel, { color: t.textSub }]}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={!loading ? <Text style={[s.empty, { color: t.textMuted }]}>Nenhuma doação encontrada.</Text> : null}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
            <View style={s.cardTop}>
              <Text style={[s.customer, { color: t.text }]} numberOfLines={1}>{item.customerName}</Text>
              <Text style={[s.dogs, { color: t.textSub }]}>{item.items?.length ?? 0} 🌭</Text>
            </View>
            <Text style={[s.dest, { color: t.textBrand }]}>
              {item.partner?.name ?? (item.observations === 'IVC_INTERNAL' ? 'IVC — A Igreja escolhe' : item.observations ?? '—')}
            </Text>
            <Text style={[s.value, { color: t.textSub }]}>{formatCurrency(item.totalValue)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  summary: { flexDirection: 'row', gap: 12, padding: 12 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  summaryNum: { fontSize: 28, fontWeight: 'bold' },
  summaryLabel: { fontSize: 12, marginTop: 2 },
  list: { padding: 12, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  card: { borderRadius: 14, padding: 14, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customer: { flex: 1, fontSize: 15, fontWeight: '600' },
  dogs: { fontSize: 14 },
  dest: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13 },
});
