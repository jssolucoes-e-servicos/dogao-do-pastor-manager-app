import { DrawerHeader } from '@/components/drawer-toggle';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Settlement = {
  id: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  contributor?: { id: string; name: string; username: string; phone?: string };
  edition?: { name: string; code: string };
  orders?: { id: string }[];
  payments?: Payment[];
};

type Payment = {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  receiptUrl?: string;
  submittedAt: string;
  confirmedAt?: string;
  notes?: string;
  settlement?: Settlement;
};

type Summary = {
  totalDue: number;
  totalPaid: number;
  pending: number;
  submitted: number;
  confirmed: number;
};

const METHOD_LABEL: Record<string, string> = {
  PIX_IVC: 'PIX IVC', CASH: 'Espécie', PIX_QRCODE: 'PIX QR Code',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function FinanceSettlementsScreen() {
  const t = useTheme().colors;
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Modais
  const [confirmModal, setConfirmModal] = useState<Payment | null>(null);
  const [registerModal, setRegisterModal] = useState<Settlement | null>(null);

  // States para registro direto
  const [regAmount, setRegAmount] = useState('');
  const [regMethod, setRegMethod] = useState<'CASH' | 'PIX_IVC'>('CASH');
  const [regNotes, setRegNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [sRes, pRes, sumRes] = await Promise.all([
        api.get<Settlement[]>('/cash-settlements'),
        api.get<Payment[]>('/cash-settlements/pending-payments'),
        api.get<Summary>('/cash-settlements/summary'),
      ]);
      setSettlements(Array.isArray(sRes) ? sRes : []);
      setPendingPayments(Array.isArray(pRes) ? pRes : []);
      setSummary(sumRes);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await api.post<any>('/cash-settlements/sync');
      Alert.alert('Sincronizado', `Sucesso: ${res?.synced ?? 0} venda(s) adicionada(s).`);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  async function handleConfirm() {
    if (!confirmModal) return;
    setSaving(true);
    try {
      await api.patch(`/cash-settlements/payments/${confirmModal.id}/confirm`);
      Alert.alert('Sucesso', 'Repasse confirmado com sucesso!');
      setConfirmModal(null);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Erro ao confirmar');
    } finally {
      setSaving(false);
    }
  }

  function openRegister(s: Settlement) {
    const balance = s.totalAmount - s.paidAmount;
    setRegAmount(balance.toFixed(2).replace('.', ','));
    setRegMethod('CASH');
    setRegNotes('');
    setRegisterModal(s);
  }

  async function handleRegister() {
    if (!registerModal) return;
    const val = parseFloat(regAmount.replace(',', '.'));
    if (!val || val <= 0) { Alert.alert('Valor inválido'); return; }
    setSaving(true);
    try {
      await api.post('/cash-settlements/register-direct', {
        contributorId: registerModal.contributor?.id,
        amount: val,
        paymentMethod: regMethod,
        notes: regNotes || undefined,
      });
      Alert.alert('Sucesso', 'Pagamento registrado com sucesso!');
      setRegisterModal(null);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Erro ao registrar');
    } finally {
      setSaving(false);
    }
  }

  // Vendedores com saldo pendente e sem repasse enviado
  const pendingBalances = settlements.filter(s => {
    const balance = s.totalAmount - s.paidAmount;
    const hasPendingPayment = pendingPayments.some(p => p.settlement?.id === s.id);
    return balance > 0.001 && !hasPendingPayment;
  });

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader
        title="Acertos (Financ)"
        right={(
          <TouchableOpacity onPress={handleSync} disabled={syncing} style={s.syncBtn}>
            {syncing ? <ActivityIndicator size="small" color={t.brand} /> : <Ionicons name="refresh" size={22} color={t.brand} />}
          </TouchableOpacity>
        )}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Resumo Financeiro ── */}
        {summary && (
          <View style={s.summaryGrid}>
            <View style={[s.summaryCard, { backgroundColor: t.bgCard }]}>
              <Text style={[s.summaryLabel, { color: t.textMuted }]}>Total Devido</Text>
              <Text style={[s.summaryValue, { color: t.text }]}>{fmt(summary.totalDue)}</Text>
            </View>
            <View style={[s.summaryCard, { backgroundColor: t.bgCard }]}>
              <Text style={[s.summaryLabel, { color: '#f97316' }]}>A Repassar</Text>
              <Text style={[s.summaryValue, { color: '#f97316' }]}>{fmt(summary.pending)}</Text>
            </View>
            <View style={[s.summaryCard, { backgroundColor: t.bgCard }]}>
              <Text style={[s.summaryLabel, { color: '#2563eb' }]}>Aguardando</Text>
              <Text style={[s.summaryValue, { color: '#2563eb' }]}>{fmt(summary.submitted)}</Text>
            </View>
            <View style={[s.summaryCard, { backgroundColor: t.bgCard }]}>
              <Text style={[s.summaryLabel, { color: '#16a34a' }]}>Confirmados</Text>
              <Text style={[s.summaryValue, { color: '#16a34a' }]}>{fmt(summary.confirmed)}</Text>
            </View>
          </View>
        )}

        {/* ── Repasses Aguardando Confirmação ── */}
        {pendingPayments.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: t.textMuted }]}>Aguardando Confirmação ({pendingPayments.length})</Text>
            {pendingPayments.map(p => (
              <TouchableOpacity key={p.id} style={[s.card, { backgroundColor: '#eff6ff', borderLeftColor: '#2563eb' }]}
                onPress={() => setConfirmModal(p)}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardTitle, { color: '#1e40af' }]}>{p.settlement?.contributor?.name}</Text>
                  <Text style={[s.cardAmount, { color: '#2563eb' }]}>{fmt(p.amount)}</Text>
                </View>
                <View style={s.cardFooter}>
                  <Text style={[s.cardSub, { color: '#3b82f6' }]}>
                    {METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod} • {fmtDate(p.submittedAt)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#3b82f6" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Saldo Pendente (sem repasse) ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.textMuted }]}>Saldos Pendentes ({pendingBalances.length})</Text>
          {pendingBalances.length === 0 && !loading && (
            <Text style={[s.emptyText, { color: t.textMuted }]}>Nenhum saldo pendente.</Text>
          )}
          {pendingBalances.map(item => {
            const balance = item.totalAmount - item.paidAmount;
            return (
              <View key={item.id} style={[s.card, { backgroundColor: t.bgCard }]}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardTitle, { color: t.text }]}>{item.contributor?.name}</Text>
                  <Text style={[s.cardAmount, { color: '#f97316' }]}>{fmt(balance)}</Text>
                </View>
                <View style={s.cardFooter}>
                  <Text style={[s.cardSub, { color: t.textMuted }]}>
                    @{item.contributor?.username} • {item.orders?.length ?? 0} venda(s)
                  </Text>
                  <TouchableOpacity
                    style={[s.miniBtn, { backgroundColor: t.brand }]}
                    onPress={() => openRegister(item)}>
                    <Text style={s.miniBtnText}>Registrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Modal: Confirmar Recebimento ── */}
      <Modal visible={!!confirmModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Confirmar Recebimento</Text>
            {confirmModal && (
              <View style={s.modalInfo}>
                <View style={s.modalRow}>
                  <Text style={[s.modalLabel, { color: t.textMuted }]}>Vendedor</Text>
                  <Text style={[s.modalValue, { color: t.text }]}>{confirmModal.settlement?.contributor?.name}</Text>
                </View>
                <View style={s.modalRow}>
                  <Text style={[s.modalLabel, { color: t.textMuted }]}>Valor</Text>
                  <Text style={[s.modalValue, { color: '#16a34a', fontSize: 24 }]}>{fmt(confirmModal.amount)}</Text>
                </View>
                <View style={s.modalRow}>
                  <Text style={[s.modalLabel, { color: t.textMuted }]}>Forma</Text>
                  <Text style={[s.modalValue, { color: t.text }]}>{METHOD_LABEL[confirmModal.paymentMethod] ?? confirmModal.paymentMethod}</Text>
                </View>
                {confirmModal.notes && (
                  <View style={s.modalRow}>
                    <Text style={[s.modalLabel, { color: t.textMuted }]}>Nota</Text>
                    <Text style={[s.modalValue, { color: t.text }]}>{confirmModal.notes}</Text>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={[s.btn, { backgroundColor: '#16a34a', marginTop: 16 }]}
              onPress={handleConfirm} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar Recebimento</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setConfirmModal(null)}>
              <Text style={[s.cancelText, { color: t.textSub }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Registrar Pagamento Direto ── */}
      <Modal visible={!!registerModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
              <Text style={[s.sheetTitle, { color: t.text }]}>Registrar Pagamento</Text>
              {registerModal && (
                <Text style={[s.sheetSub, { color: t.textSub }]}>
                  {registerModal.contributor?.name} • Saldo: {fmt(registerModal.totalAmount - registerModal.paidAmount)}
                </Text>
              )}

              <Text style={[s.fieldLabel, { color: t.textSub, marginTop: 12 }]}>Valor Recebido</Text>
              <TextInput
                style={[s.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
                value={regAmount} onChangeText={setRegAmount} keyboardType="decimal-pad"
                placeholder="0,00" placeholderTextColor={t.textMuted}
              />

              <Text style={[s.fieldLabel, { color: t.textSub }]}>Forma de Pagamento</Text>
              <View style={s.methodRow}>
                <TouchableOpacity
                  style={[s.methodBtn, regMethod === 'CASH' && { backgroundColor: '#16a34a' }, { borderColor: t.border }]}
                  onPress={() => setRegMethod('CASH')}>
                  <Text style={[s.methodBtnText, regMethod === 'CASH' && { color: '#fff' }, { color: t.textMuted }]}>💵 Espécie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.methodBtn, regMethod === 'PIX_IVC' && { backgroundColor: '#2563eb' }, { borderColor: t.border }]}
                  onPress={() => setRegMethod('PIX_IVC')}>
                  <Text style={[s.methodBtnText, regMethod === 'PIX_IVC' && { color: '#fff' }, { color: t.textMuted }]}>📱 PIX IVC</Text>
                </TouchableOpacity>
              </View>

              <Text style={[s.fieldLabel, { color: t.textSub }]}>Observação (opcional)</Text>
              <TextInput
                style={[s.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border, height: 50, fontSize: 14 }]}
                value={regNotes} onChangeText={setRegNotes}
                placeholder="Ex: Recebido no culto" placeholderTextColor={t.textMuted}
              />

              <TouchableOpacity style={[s.btn, { backgroundColor: t.brand, marginTop: 16 }]}
                onPress={handleRegister} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar Registro</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setRegisterModal(null)}>
                <Text style={[s.cancelText, { color: t.textSub }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 20, paddingBottom: 40 },
  syncBtn: { padding: 8 },

  // Resumo
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { flexBasis: '48%', flexGrow: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  summaryLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 18, fontWeight: '800' },

  // Seções e Cards
  section: { gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  card: { borderRadius: 20, padding: 16, gap: 10, borderLeftWidth: 4, borderLeftColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'between', alignItems: 'center' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  cardAmount: { fontSize: 18, fontWeight: '800' },
  cardFooter: { flexDirection: 'row', justifyContent: 'between', alignItems: 'center' },
  cardSub: { flex: 1, fontSize: 12, fontWeight: '600' },

  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  miniBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  emptyText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  // Modais e Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 14, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  sheetTitle: { fontSize: 22, fontWeight: '900' },
  sheetSub: { fontSize: 14, fontWeight: '600', marginTop: -6 },

  modalInfo: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 20, padding: 16, gap: 12 },
  modalRow: { flexDirection: 'row', justifyContent: 'between', alignItems: 'center' },
  modalLabel: { fontSize: 12, fontWeight: '600' },
  modalValue: { fontSize: 16, fontWeight: '800' },

  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -4 },
  input: { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 18, fontWeight: '800', textAlign: 'center' },

  methodRow: { flexDirection: 'row', gap: 10 },
  methodBtn: { flex: 1, borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: 'center' },
  methodBtnText: { fontSize: 14, fontWeight: '700' },

  btn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
