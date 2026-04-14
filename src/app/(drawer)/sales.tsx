import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Order = {
  id: string;
  customerName: string;
  totalValue: number;
  status: string;
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
  items: { id: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pago',
  PENDING_PAYMENT: 'Aguardando',
  CANCELLED: 'Cancelado',
  DIGITATION: 'Em digitação',
};

const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a',
  PENDING_PAYMENT: '#d97706',
  CANCELLED: '#dc2626',
  DIGITATION: '#6b7280',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SalesScreen() {
  const { user } = useAuth();
  const t = useTheme().colors;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      // Usa GET /orders — o backend filtra automaticamente por createdByContributorId
      // e por sellerId do usuário logado (via JWT)
      const data = await api.get<{ data: Order[] }>('/orders?perPage=50');
      const orders = data?.data ?? (Array.isArray(data) ? data : []);
      setOrders(orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Minhas Vendas" />

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>
                Nenhuma venda encontrada.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.paymentStatus] ?? '#6b7280';
          return (
            <View style={[styles.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.customerName, { color: t.text }]} numberOfLines={1}>{item.customerName}</Text>
                <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.paymentStatus] ?? item.paymentStatus}</Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.dogs, { color: t.textSub }]}>{item.items?.length ?? 0} 🌭</Text>
                <Text style={[styles.value, { color: t.text }]}>{formatCurrency(item.totalValue)}</Text>
                <Text style={[styles.method, { color: t.textMuted }]}>{item.paymentType}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  card: { borderRadius: 14, padding: 14, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  customerName: { flex: 1, fontSize: 15, fontWeight: '600', marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dogs: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '700', flex: 1 },
  method: { fontSize: 12 },
});
