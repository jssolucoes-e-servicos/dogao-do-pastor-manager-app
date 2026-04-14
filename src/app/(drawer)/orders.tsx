import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Order = {
  id: string; customerName: string; customerPhone: string;
  totalValue: number; status: string; paymentStatus: string;
  paymentType: string; deliveryOption: string; createdAt: string;
  items: { id: string }[]; seller?: { tag: string };
};

const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a', PENDING_PAYMENT: '#d97706', CANCELLED: '#dc2626',
  DIGITATION: '#6b7280', QUEUE: '#7c3aed', PRODUCTION: '#2563eb',
  EXPEDITION: '#0891b2', DELIVERING: '#ea580c', DELIVERED: '#16a34a',
};
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pago', PENDING_PAYMENT: 'Aguardando', CANCELLED: 'Cancelado',
  DIGITATION: 'Digitação', QUEUE: 'Fila', PRODUCTION: 'Produção',
  EXPEDITION: 'Expedição', DELIVERING: 'Entrega', DELIVERED: 'Entregue',
};
const DELIVERY_ICON: Record<string, string> = { PICKUP: '🏪', DELIVERY: '🛵', DONATE: '🤝', UNDEFINED: '—' };

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function OrdersScreen() {
  const t = useTheme().colors;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING_PAYMENT' | 'PAID'>('ALL');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ data: Order[] }>('/orders?limit=100');
      setOrders(Array.isArray(res?.data) ? res.data : []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.customerName.toLowerCase().includes(search.toLowerCase()) || o.customerPhone.includes(search);
    const matchFilter = filter === 'ALL' || o.paymentStatus === filter;
    return matchSearch && matchFilter;
  });

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Pedidos" />

      <View style={s.searchRow}>
        <TextInput
          style={[s.search, { backgroundColor: t.bgCard, borderColor: t.border, color: t.text }]}
          placeholder="Buscar cliente ou telefone..."
          placeholderTextColor={t.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={s.filters}>
        {(['ALL', 'PENDING_PAYMENT', 'PAID'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterBtn, { backgroundColor: t.bgCard, borderColor: t.border }, filter === f && { backgroundColor: t.brand, borderColor: t.brand }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, { color: t.textSub }, filter === f && { color: '#fff' }]}>
              {f === 'ALL' ? 'Todos' : f === 'PENDING_PAYMENT' ? 'Pendentes' : 'Pagos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={!loading ? <Text style={[s.empty, { color: t.textMuted }]}>Nenhum pedido encontrado.</Text> : null}
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.paymentStatus] ?? '#6b7280';
          return (
            <View style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
              <View style={s.cardTop}>
                <Text style={[s.customer, { color: t.text }]} numberOfLines={1}>{item.customerName}</Text>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeText, { color }]}>{STATUS_LABEL[item.paymentStatus] ?? item.paymentStatus}</Text>
                </View>
              </View>
              <View style={s.cardMid}>
                <Text style={[s.phone, { color: t.textSub }]}>{item.customerPhone}</Text>
                <Text style={[s.tag, { color: t.textBrand }]}>{item.seller?.tag ?? '—'}</Text>
              </View>
              <View style={s.cardBot}>
                <Text style={s.delivery}>{DELIVERY_ICON[item.deliveryOption] ?? '—'}</Text>
                <Text style={[s.dogs, { color: t.textSub }]}>{item.items?.length ?? 0} 🌭</Text>
                <Text style={[s.value, { color: t.text }]}>{formatCurrency(item.totalValue)}</Text>
                <Text style={[s.method, { color: t.textMuted }]}>{item.paymentType}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  searchRow: { padding: 12, paddingBottom: 4 },
  search: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: '500' },
  list: { padding: 12, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  card: { borderRadius: 14, padding: 14, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  customer: { flex: 1, fontSize: 15, fontWeight: '600', marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  phone: { fontSize: 12 },
  tag: { fontSize: 12, fontWeight: '600' },
  cardBot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  delivery: { fontSize: 14 },
  dogs: { fontSize: 13 },
  value: { flex: 1, fontSize: 14, fontWeight: '700' },
  method: { fontSize: 12 },
});
