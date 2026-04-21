import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

// O backend retorna 1 settlement por edição com todos os repasses
type Payment = {
  id: string;
  amount: number;
  paymentMethod: string;
  status: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  submittedAt: string;
  confirmedAt?: string;
};

type Settlement = {
  id: string;
  totalAmount: number;   // soma de todas as vendas em dinheiro
  paidAmount: number;    // soma dos repasses confirmados
  status: string;
  edition: { name: string; code: string };
  orders: { id: string; amount: number }[];
  payments: Payment[];
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Aguardando confirmação',
  CONFIRMED: 'Confirmado',
  CANCELLED: 'Cancelado',
};
const PAYMENT_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: '#2563eb',
  CONFIRMED: '#16a34a',
  CANCELLED: '#dc2626',
};
const METHOD_LABEL: Record<string, string> = {
  PIX_QRCODE: 'PIX QR Code',
  PIX_IVC: 'PIX IVC',
  CASH: 'Tesouraria (espécie)',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

type ModalType = 'choose' | 'cash_confirm' | 'pix_ivc' | 'pix_qr' | null;

export default function MySettlementScreen() {
  const t = useTheme().colors;
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ uri: string } | null>(null);
  const [pixData, setPixData] = useState<{ qrCodeBase64?: string; pixCopyPaste?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Settlement[]>('/cash-settlements/me');
      setSettlements(Array.isArray(data) ? data : []);
    } catch { setSettlements([]); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  const totalPaid = settlements.reduce((a, s) => a + s.paidAmount, 0);

  function openChoose(s: Settlement) {
    const balance = s.totalAmount - s.paidAmount;
    setSelected(s);
    setAmount(balance.toFixed(2).replace('.', ','));
    setReceipt(null);
    setPixData(null);
    setModalType('choose');
  }

  async function handlePixQrCode() {
    if (!selected) return;
    const val = parseFloat(amount.replace(',', '.'));
    if (!val || val <= 0) { Alert.alert('Valor inválido'); return; }
    setSubmitting(true);
    try {
      const data = await api.post<any>(`/cash-settlements/${selected.id}/pix-qrcode`, { amount: val });
      setPixData({ qrCodeBase64: data.qrCodeBase64, pixCopyPaste: data.pixCopyPaste });
      setModalType('pix_qr');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message || 'Erro ao gerar PIX'); }
    setSubmitting(false);
  }

  async function pickReceipt() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setReceipt({ uri: result.assets[0].uri });
    } catch { Alert.alert('Erro', 'Não foi possível abrir a galeria'); }
  }

  async function handlePixIvc() {
    if (!selected) return;
    const val = parseFloat(amount.replace(',', '.'));
    if (!val || val <= 0) { Alert.alert('Valor inválido'); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', String(val));
      formData.append('receiptDate', new Date().toISOString());
      if (receipt?.uri) formData.append('receipt', { uri: receipt.uri, type: 'image/jpeg', name: 'comprovante.jpg' } as any);
      await api.post(`/cash-settlements/${selected.id}/submit-pix-ivc`, formData);
      Alert.alert('Enviado!', 'Comprovante enviado. Aguarde a confirmação da tesoureira.');
      setModalType(null);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message || 'Erro ao enviar'); }
    setSubmitting(false);
  }

  async function handleCash() {
    if (!selected) return;
    const val = parseFloat(amount.replace(',', '.'));
    if (!val || val <= 0) { Alert.alert('Valor inválido'); return; }
    setSubmitting(true);
    try {
      await api.post(`/cash-settlements/${selected.id}/submit-cash`, { amount: val });
      Alert.alert('Informado!', 'Repasse informado. Aguarde a confirmação da tesoureira.');
      setModalType(null);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message || 'Erro ao informar'); }
    setSubmitting(false);
  }

  async function copyPix() {
    if (!pixData?.pixCopyPaste) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(pixData.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { Alert.alert('Código PIX', pixData.pixCopyPaste); }
  }

  // Pega o settlement ativo (deve ser apenas 1 por edição)
  const settlement = settlements[0] ?? null;
  const balance = settlement ? settlement.totalAmount - settlement.paidAmount : 0;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Meu Acerto" />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {!settlement && !loading && (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: t.textMuted }]}>Nenhum acerto encontrado.</Text>
            <Text style={[s.emptyText, { color: t.textMuted, fontSize: 12, marginTop: 4 }]}>
              Vendas em dinheiro pelo app aparecerão aqui.
            </Text>
          </View>
        )}

        {settlement && (
          <>
            {/* ── Cards de saldo ── */}
            <View style={s.row}>
              <View style={[s.balanceCard, { backgroundColor: balance > 0.001 ? t.brand : '#16a34a' }]}>
                <Text style={s.balanceLabel}>Saldo a Repassar</Text>
                <Text style={s.balanceValue}>{fmt(balance)}</Text>
                <Text style={s.balanceSub}>{settlement.orders?.length ?? 0} venda(s) em dinheiro</Text>
              </View>
              <View style={[s.balanceCard, { backgroundColor: t.bgCard }]}>
                <Text style={[s.balanceLabel, { color: t.textMuted }]}>Total Confirmado</Text>
                <Text style={[s.balanceValue, { color: '#16a34a' }]}>{fmt(totalPaid)}</Text>
                <Text style={[s.balanceSub, { color: t.textMuted }]}>Total vendido: {fmt(settlement.totalAmount)}</Text>
              </View>
            </View>

            {/* ── Botão de repasse ── */}
            {balance > 0.001 && (
              <TouchableOpacity
                style={[s.repayBtn, { backgroundColor: t.brand }]}
                onPress={() => openChoose(settlement)}
              >
                <Text style={s.repayBtnText}>💸 Fazer Repasse</Text>
              </TouchableOpacity>
            )}

            {/* ── Histórico de repasses ── */}
            {settlement.payments.length > 0 && (
              <View style={[s.section, { backgroundColor: t.bgCard }]}>
                <Text style={[s.sectionTitle, { color: t.textMuted }]}>Histórico de Repasses</Text>
                {settlement.payments.map((p, i) => {
                  const color = PAYMENT_STATUS_COLOR[p.status] ?? '#6b7280';
                  const isLast = i === settlement.payments.length - 1;
                  return (
                    <View key={p.id} style={[s.paymentRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.paymentMethod, { color: t.text }]}>{METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</Text>
                        <Text style={[s.paymentDate, { color: t.textMuted }]}>{fmtDate(p.submittedAt)}</Text>
                        {p.confirmedAt && (
                          <Text style={[s.paymentDate, { color: '#16a34a' }]}>✓ Confirmado em {fmtDate(p.confirmedAt)}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[s.paymentAmount, { color: t.text }]}>{fmt(p.amount)}</Text>
                        <View style={[s.badge, { backgroundColor: color + '22' }]}>
                          <Text style={[s.badgeText, { color }]}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Modal: Escolher método ── */}
      <Modal visible={modalType === 'choose'} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Como vai repassar?</Text>
            <Text style={[s.sheetSub, { color: t.textSub }]}>
              Saldo devedor: {fmt(selected ? selected.totalAmount - selected.paidAmount : 0)}
            </Text>
            <Text style={[s.fieldLabel, { color: t.textSub }]}>Valor do repasse</Text>
            <TextInput
              style={[s.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
              value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
              placeholder="0,00" placeholderTextColor={t.textMuted}
            />
            <View style={s.methodGrid}>
              <TouchableOpacity style={[s.methodCard, { backgroundColor: '#7c3aed' }]}
                onPress={handlePixQrCode} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={s.methodIcon}>📱</Text>
                    <Text style={s.methodLabel}>PIX QR Code</Text>
                    <Text style={s.methodDesc}>Mercado Pago</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.methodCard, { backgroundColor: '#2563eb' }]}
                onPress={() => setModalType('pix_ivc')}>
                <Text style={s.methodIcon}>💸</Text>
                <Text style={s.methodLabel}>PIX IVC</Text>
                <Text style={s.methodDesc}>Conta da Igreja</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.methodCard, { backgroundColor: '#16a34a' }]}
                onPress={() => setModalType('cash_confirm')}>
                <Text style={s.methodIcon}>💵</Text>
                <Text style={s.methodLabel}>Tesouraria</Text>
                <Text style={s.methodDesc}>Dinheiro em espécie</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalType(null)}>
              <Text style={[s.cancelText, { color: t.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Confirmar espécie ── */}
      <Modal visible={modalType === 'cash_confirm'} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Confirmar Repasse</Text>
            <Text style={[s.sheetSub, { color: t.textSub }]}>
              Você está informando que entregará {fmt(parseFloat(amount.replace(',', '.')) || 0)} em espécie para a tesoureira.
            </Text>
            <View style={[s.infoBox, { backgroundColor: t.bg }]}>
              <Text style={[s.infoText, { color: t.textSub }]}>
                Ficará pendente até a tesoureira confirmar o recebimento.
              </Text>
            </View>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#16a34a', marginTop: 16 }]}
              onPress={handleCash} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Confirmar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalType('choose')}>
              <Text style={[s.cancelText, { color: t.textSub }]}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: PIX IVC ── */}
      <Modal visible={modalType === 'pix_ivc'} animationType="slide" transparent>
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
              <Text style={[s.sheetTitle, { color: t.text }]}>PIX para IVC</Text>
              <View style={[s.infoBox, { backgroundColor: '#eff6ff' }]}>
                <Text style={[s.fieldLabel, { color: '#1d4ed8' }]}>Chave PIX da Igreja</Text>
                <Text style={[s.infoText, { color: '#1e40af', fontWeight: '700' }]}>
                  igrejavivaemcelulas@gmail.com
                </Text>
              </View>
              <Text style={[s.fieldLabel, { color: t.textSub }]}>Valor enviado</Text>
              <TextInput
                style={[s.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
                value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
                placeholder="0,00" placeholderTextColor={t.textMuted}
              />
              <Text style={[s.fieldLabel, { color: t.textSub }]}>Comprovante do PIX</Text>
              <TouchableOpacity style={[s.uploadBtn, { borderColor: t.border, backgroundColor: t.bg }]}
                onPress={pickReceipt}>
                {receipt ? (
                  <Image source={{ uri: receipt.uri }} style={s.receiptPreview} resizeMode="cover" />
                ) : (
                  <Text style={[s.uploadText, { color: t.textMuted }]}>📎 Toque para anexar comprovante</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#2563eb', marginTop: 8 }]}
                onPress={handlePixIvc} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Enviar Comprovante</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalType('choose')}>
                <Text style={[s.cancelText, { color: t.textSub }]}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal: PIX QR Code ── */}
      <Modal visible={modalType === 'pix_qr'} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: t.bgCard, alignItems: 'center' }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>PIX QR Code</Text>
            {pixData?.qrCodeBase64 ? (
              <Image source={{ uri: `data:image/png;base64,${pixData.qrCodeBase64}` }}
                style={s.qrCode} resizeMode="contain" />
            ) : (
              <View style={[s.qrCode, { backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={t.brand} size="large" />
              </View>
            )}
            {pixData?.pixCopyPaste && (
              <TouchableOpacity style={[s.copyBox, { backgroundColor: t.bg, borderColor: t.border }]}
                onPress={copyPix}>
                <Text style={[s.copyText, { color: t.textSub }]} numberOfLines={2}>{pixData.pixCopyPaste}</Text>
                <Text style={[s.copyHint, { color: t.brand }]}>
                  {copied ? '✓ Copiado!' : '📋 Toque para copiar'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={[s.infoBox, { backgroundColor: t.bg, marginTop: 8 }]}>
              <Text style={[s.infoText, { color: t.textSub }]}>
                Após o pagamento, o saldo será atualizado automaticamente.
              </Text>
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalType(null)}>
              <Text style={[s.cancelText, { color: t.textSub }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center' },

  // Saldo
  row: { flexDirection: 'row', gap: 12 },
  balanceCard: { flex: 1, borderRadius: 16, padding: 16, gap: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  balanceValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  balanceSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  // Botão repasse
  repayBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  repayBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Histórico
  section: { borderRadius: 16, padding: 16, gap: 0 },
  sectionTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  paymentMethod: { fontSize: 14, fontWeight: '600' },
  paymentDate: { fontSize: 11, marginTop: 2 },
  paymentAmount: { fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },

  // Modais
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12, paddingBottom: 40 },
  sheetTitle: { fontSize: 22, fontWeight: '800' },
  sheetSub: { fontSize: 14, marginTop: -4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  methodGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  methodCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  methodIcon: { fontSize: 24 },
  methodLabel: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  methodDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 10, textAlign: 'center' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
  infoBox: { borderRadius: 14, padding: 14, gap: 4 },
  infoText: { fontSize: 13, fontWeight: '500' },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  uploadBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 16, alignItems: 'center', minHeight: 80, justifyContent: 'center' },
  uploadText: { fontSize: 14, fontWeight: '500' },
  receiptPreview: { width: '100%', height: 120, borderRadius: 10 },
  qrCode: { width: 200, height: 200, borderRadius: 16, marginVertical: 8 },
  copyBox: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  copyText: { fontSize: 11, fontFamily: 'monospace' },
  copyHint: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
