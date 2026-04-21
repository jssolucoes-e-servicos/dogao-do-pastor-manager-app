import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Order = {
  id: string;
  customerName: string;
  totalValue: number;
  paymentStatus: string;
  paymentType: string;
  createdAt: string;
  items: { id: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pago', PENDING_PAYMENT: 'Aguardando', CANCELLED: 'Cancelado',
  DIGITATION: 'Em digitação', QUEUE: 'Na fila', PRODUCTION: 'Em produção', DELIVERED: 'Entregue',
};
const STATUS_COLOR: Record<string, string> = {
  PAID: '#16a34a', PENDING_PAYMENT: '#d97706', CANCELLED: '#dc2626',
  DIGITATION: '#6b7280', QUEUE: '#2563eb', PRODUCTION: '#7c3aed', DELIVERED: '#16a34a',
};
const PAYMENT_LABEL: Record<string, string> = {
  PIX: 'PIX', CARD_CREDIT: 'Cartão de Crédito', CARD_DEBIT: 'Cartão de Débito',
  MONEY: 'Dinheiro', POS: 'Maquininha', UNDEFINED: '—',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function SalesScreen() {
  const t = useTheme().colors;
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<any>('/orders?perPage=50');
      const list: Order[] = data?.data ?? (Array.isArray(data) ? data : []);
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // Recarrega sempre que a tela recebe foco (volta do detalhe, nova venda, etc.)
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Minhas Vendas" />

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: t.textMuted }]}>Nenhuma venda encontrada.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.paymentStatus] ?? '#6b7280';
          return (
            <TouchableOpacity
              style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}
              onPress={() => router.push({ pathname: '/order-detail', params: { id: item.id } })}
              activeOpacity={0.75}
            >
              <View style={s.cardTop}>
                <Text style={[s.customerName, { color: t.text }]} numberOfLines={1}>
                  {item.customerName}
                </Text>
                <View style={[s.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.badgeText, { color }]}>
                    {STATUS_LABEL[item.paymentStatus] ?? item.paymentStatus}
                  </Text>
                </View>
              </View>
              <View style={s.cardBottom}>
                <Text style={[s.dogs, { color: t.textSub }]}>{item.items?.length ?? 0} 🌭</Text>
                <Text style={[s.value, { color: t.text }]}>{fmt(item.totalValue)}</Text>
                <Text style={[s.method, { color: t.textMuted }]}>
                  {PAYMENT_LABEL[item.paymentType] ?? item.paymentType}
                </Text>
                <Text style={[s.date, { color: t.textMuted }]}>{fmtDate(item.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  card: {
    borderRadius: 14, padding: 14,
    shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  customerName: { flex: 1, fontSize: 15, fontWeight: '600', marginRight: 8 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dogs: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '700', flex: 1 },
  method: { fontSize: 12 },
  date: { fontSize: 11 },
});
