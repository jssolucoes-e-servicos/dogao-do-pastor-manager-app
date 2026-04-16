import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Settlement = {
  id: string;
  totalAmount: number;
  status: string;
  paymentMethod?: string;
  submittedAt?: string;
  confirmedAt?: string;
  edition: { name: string; code: string };
  orders: { id: string; amount: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  SUBMITTED: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#d97706',
  SUBMITTED: '#2563eb',
  CONFIRMED: '#16a34a',
  CANCELLED: '#dc2626',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function MySettlementScreen() {
  const t = useTheme().colors;
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitModal, setSubmitModal] = useState<Settlement | null>(null);
  const [payMethod, setPayMethod] = useState<'PIX' | 'CASH'>('PIX');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Settlement[]>('/cash-settlements/me');
      setSettlements(Array.isArray(data) ? data : []);
    } catch {
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit() {
    if (!submitModal) return;
    setSubmitting(true);
    try {
      await api.patch(`/cash-settlements/${submitModal.id}/submit`, {
        paymentMethod: payMethod,
        notes: notes || undefined,
      });
      setSubmitModal(null);
      setNotes('');
      load();
    } catch (e: any) {
      // handle error
    } finally {
      setSubmitting(false);
    }
  }

  const pending = settlements.filter(s => s.status === 'PENDING');
  const totalPending = pending.reduce((a, s) => a + s.totalAmount, 0);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Meu Acerto" />

      {totalPending > 0 && (
        <View style={[styles.banner, { backgroundColor: t.brand }]}>
          <Text style={styles.bannerLabel}>Saldo a repassar</Text>
          <Text style={styles.bannerValue}>{formatCurrency(totalPending)}</Text>
        </View>
      )}

      <FlatList
        data={settlements}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: t.textMuted }]}>Nenhum acerto encontrado.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const color = STATUS_COLOR[item.status] ?? '#6b7280';
          return (
            <View style={[styles.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.edition, { color: t.text }]}>{item.edition?.name}</Text>
                  <Text style={[styles.orders, { color: t.textSub }]}>{item.orders?.length ?? 0} venda(s) em dinheiro</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              <Text style={[styles.amount, { color: t.text }]}>{formatCurrency(item.totalAmount)}</Text>
              {item.status === 'PENDING' && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: t.brand }]}
                  onPress={() => setSubmitModal(item)}
                >
                  <Text style={styles.btnText}>Informar Repasse</Text>
                </TouchableOpacity>
              )}
              {item.status === 'SUBMITTED' && (
                <Text style={[styles.hint, { color: t.textMuted }]}>
                  Aguardando confirmação da tesoureira via {item.paymentMethod === 'PIX' ? 'PIX' : 'Espécie'}
                </Text>
              )}
              {item.status === 'CONFIRMED' && (
                <Text style={[styles.hint, { color: '#16a34a' }]}>✓ Recebimento confirmado</Text>
              )}
            </View>
          );
        }}
      />

      {/* Modal de repasse */}
      <Modal visible={!!submitModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: t.bgCard }]}>
            <Text style={[styles.modalTitle, { color: t.text }]}>Informar Repasse</Text>
            <Text style={[styles.modalSub, { color: t.textSub }]}>
              Valor: {formatCurrency(submitModal?.totalAmount ?? 0)}
            </Text>

            <Text style={[styles.label, { color: t.textSub }]}>Como você vai repassar?</Text>
            <View style={styles.methodRow}>
              {(['PIX', 'CASH'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodBtn, payMethod === m && { backgroundColor: t.brand }]}
                  onPress={() => setPayMethod(m)}
                >
                  <Text style={[styles.methodText, payMethod === m && { color: '#fff' }]}>
                    {m === 'PIX' ? '📱 PIX' : '💵 Espécie'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: t.textSub }]}>Observação (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
              placeholder="Ex: PIX enviado às 19h"
              placeholderTextColor={t.textMuted}
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: t.brand, marginTop: 8 }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Confirmar Repasse</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondary]} onPress={() => setSubmitModal(null)}>
              <Text style={[styles.btnSecondaryText, { color: t.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { margin: 16, borderRadius: 16, padding: 16, alignItems: 'center' },
  bannerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  bannerValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center' },
  card: { borderRadius: 16, padding: 16, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  edition: { fontSize: 15, fontWeight: '700' },
  orders: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: '800' },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSecondary: { paddingVertical: 12, alignItems: 'center' },
  btnSecondaryText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSub: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginTop: 4 },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f1f5f9' },
  methodText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
});
