import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput, FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';

const INGREDIENTS = ['Batata Palha','Catchup','Ervilha','Maionese','Milho','Molho Vermelho','Molho 4 queijos','Mostarda','Pão','Salsicha'];

type OrderItem = { id: string; removedIngredients: string[] };
type Address = { id: string; street: string; number: string; neighborhood: string; city: string; state: string };
type Partner = { id: string; name: string; addressInLine: string };
type Order = {
  id: string; customerName: string; customerPhone: string; totalValue: number;
  status: string; paymentStatus: string; paymentType: string; deliveryOption: string;
  deliveryTime?: string; observations?: string; createdAt: string; addressId?: string;
  items: OrderItem[]; seller?: { name: string; tag: string }; edition?: { name: string };
  customer?: { addresses?: Address[] };
};

const STATUS_LABEL: Record<string,string> = { PAID:'Pago', PENDING_PAYMENT:'Aguardando', CANCELLED:'Cancelado', DIGITATION:'Em digitação', QUEUE:'Na fila', PRODUCTION:'Em produção', DELIVERED:'Entregue' };
const STATUS_COLOR: Record<string,string> = { PAID:'#16a34a', PENDING_PAYMENT:'#d97706', CANCELLED:'#dc2626', DIGITATION:'#6b7280', QUEUE:'#2563eb', PRODUCTION:'#7c3aed', DELIVERED:'#16a34a' };
const PAYMENT_LABEL: Record<string,string> = { PIX:'PIX', CARD_CREDIT:'Cartão de Crédito', CARD_DEBIT:'Cartão de Débito', MONEY:'Dinheiro', POS:'Maquininha', UNDEFINED:'—' };
const DELIVERY_LABEL: Record<string,string> = { PICKUP:'Retirada no Local', DELIVERY:'Entrega', DONATE:'Doação', UNDEFINED:'—' };

function fmt(v: number) { return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function groupItems(items: OrderItem[]) {
  const map: Record<string,number> = {};
  for (const item of items) {
    const key = item.removedIngredients.length > 0 ? `Sem ${item.removedIngredients.join(', ')}` : 'Dogão Completo';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).map(([name, qty]) => ({ name, qty }));
}

function Row({ label, value, valueColor, t }: { label:string; value:string; valueColor?:string; t:any }) {
  return (
    <View style={[r.row, { borderBottomColor: t.separator }]}>
      <Text style={[r.label, { color: t.textSub }]}>{label}</Text>
      <Text style={[r.value, { color: valueColor ?? t.text }]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme().colors;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);

  // Modais
  const [receiptModal, setReceiptModal] = useState(false);
  const [modifyModal, setModifyModal] = useState(false);
  const [modifyStep, setModifyStep] = useState<'menu'|'type'|'schedule'|'ingredients'|'address'|'partner'>('menu');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modify state
  const [newDelivery, setNewDelivery] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [donationTarget, setDonationTarget] = useState('IVC_INTERNAL');
  const [editingItemId, setEditingItemId] = useState<string|null>(null);
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [orderData, partnerData] = await Promise.all([
        api.get<Order>(`/orders/${id}`),
        api.get<Partner[]>('/partners/for-orders').catch(() => []),
      ]);
      setOrder(orderData);
      if (Array.isArray(partnerData)) setPartners(partnerData);
      setNewTime(orderData.deliveryTime ?? '');
      setNewDelivery(orderData.deliveryOption);
      setSelectedAddressId(orderData.addressId ?? '');
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o pedido');
      router.back();
    } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, [id]));

  async function sendReceipt() {
    if (!order) return;
    setSending(true);
    try {
      await api.post(`/orders/${order.id}/send-receipt`, {});
      Alert.alert('Enviado!', 'Comprovante PDF enviado por WhatsApp.');
      setReceiptModal(false);
    } catch (e: any) { Alert.alert('Erro', e.message || 'Não foi possível enviar'); }
    setSending(false);
  }

  async function downloadReceipt() {
    if (!order) return;
    try {
      const { openBrowserAsync } = await import('expo-web-browser');
      const apiBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/v1';
      await openBrowserAsync(`${apiBase}/orders/${order.id}/receipt.pdf`);
      setReceiptModal(false);
    } catch { Alert.alert('Erro', 'Não foi possível abrir o comprovante'); }
  }

  async function saveDeliveryType() {
    if (!order) return;
    setSaving(true);
    try {
      if (newDelivery === 'PICKUP') {
        await api.post('/orders/set-pickup', { orderId: order.id });
      } else if (newDelivery === 'DELIVERY') {
        if (!selectedAddressId && !newAddress) { Alert.alert('Informe o endereço'); setSaving(false); return; }
        await api.post('/orders/set-delivery', { orderId: order.id, addressId: selectedAddressId || undefined, address: newAddress || undefined, scheduledTime: newTime || undefined });
      } else if (newDelivery === 'DONATE') {
        await api.post('/orders/set-donation', { orderId: order.id, partnerId: donationTarget });
      }
      Alert.alert('Salvo!', 'Tipo de pedido atualizado.');
      setModifyModal(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  }

  async function saveSchedule() {
    if (!order) return;
    setSaving(true);
    try {
      await api.post('/orders/set-delivery', { orderId: order.id, addressId: order.addressId || undefined, scheduledTime: newTime });
      Alert.alert('Salvo!', 'Horário atualizado.');
      setModifyModal(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  }

  async function saveIngredients() {
    if (!editingItemId || !order) return;
    setSaving(true);
    try {
      await api.put(`/orders/${order.id}/items/${editingItemId}`, { removedIngredients });
      Alert.alert('Salvo!', 'Ingredientes atualizados.');
      setEditingItemId(null);
      setModifyModal(false);
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    setSaving(false);
  }

  if (loading || !order) {
    return (
      <View style={[s.container, { backgroundColor: t.bg, justifyContent:'center', alignItems:'center' }]}>
        <ActivityIndicator color={t.brand} size="large" />
      </View>
    );
  }

  const statusColor = STATUS_COLOR[order.paymentStatus] ?? '#6b7280';
  const grouped = groupItems(order.items ?? []);
  const canModify = !['QUEUE','PRODUCTION','EXPEDITION','DELIVERING','DELIVERED'].includes(order.status);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <View style={[s.header, { backgroundColor: t.brand }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{order.customerName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}</Text>
        </View>

        <View style={[s.section, { backgroundColor: t.bgCard }]}>
          <Text style={[s.sectionTitle, { color: t.textMuted }]}>Pedido</Text>
          <Row label="Nº" value={`#${order.id.slice(-8).toUpperCase()}`} t={t} />
          <Row label="Edição" value={order.edition?.name ?? '—'} t={t} />
          <Row label="Data" value={fmtDate(order.createdAt)} t={t} />
          <Row label="Vendedor" value={order.seller?.name ?? '—'} t={t} />
        </View>

        <View style={[s.section, { backgroundColor: t.bgCard }]}>
          <Text style={[s.sectionTitle, { color: t.textMuted }]}>Cliente</Text>
          <Row label="Nome" value={order.customerName} t={t} />
          <Row label="Telefone" value={order.customerPhone} t={t} />
          <Row label="Entrega" value={DELIVERY_LABEL[order.deliveryOption] ?? order.deliveryOption} t={t} />
          {order.deliveryTime && <Row label="Horário" value={order.deliveryTime} t={t} />}
        </View>

        <View style={[s.section, { backgroundColor: t.bgCard }]}>
          <Text style={[s.sectionTitle, { color: t.textMuted }]}>Itens</Text>
          {grouped.map(({ name, qty }) => (
            <View key={name} style={[s.itemRow, { borderBottomColor: t.separator }]}>
              <Text style={[s.itemQty, { color: t.brand }]}>{qty}x</Text>
              <Text style={[s.itemName, { color: t.text }]}>{name}</Text>
              <Text style={[s.itemPrice, { color: t.textSub }]}>{fmt(qty * (order.totalValue / (order.items?.length || 1)))}</Text>
            </View>
          ))}
          <View style={[s.totalRow, { borderTopColor: t.separator }]}>
            <Text style={[s.totalLabel, { color: t.textSub }]}>Total</Text>
            <Text style={[s.totalValue, { color: t.brand }]}>{fmt(order.totalValue)}</Text>
          </View>
        </View>

        <View style={[s.section, { backgroundColor: t.bgCard }]}>
          <Text style={[s.sectionTitle, { color: t.textMuted }]}>Pagamento</Text>
          <Row label="Forma" value={PAYMENT_LABEL[order.paymentType] ?? order.paymentType} t={t} />
          <Row label="Status" value={order.paymentStatus === 'PAID' ? '✓ Pago' : 'Aguardando'} valueColor={statusColor} t={t} />
        </View>

        {/* Botões principais */}
        <View style={s.actions}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => setReceiptModal(true)}>
            <Text style={s.actionBtnText}>📄 Comprovante</Text>
          </TouchableOpacity>
          {canModify && (
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: t.bgCard, borderWidth: 1.5, borderColor: t.brand }]}
              onPress={() => { setModifyStep('menu'); setModifyModal(true); }}>
              <Text style={[s.actionBtnText, { color: t.brand }]}>✏️ Modificar</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Modal Comprovante ── */}
      <Modal visible={receiptModal} animationType="slide" transparent onRequestClose={() => setReceiptModal(false)}>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[m.title, { color: t.text }]}>Comprovante</Text>
            <TouchableOpacity style={[m.btn, { backgroundColor: '#25D366' }]} onPress={sendReceipt} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>📲 Enviar 2ª via ao Cliente</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[m.btn, { backgroundColor: t.text }]} onPress={downloadReceipt}>
              <Text style={m.btnText}>📄 Baixar PDF para eu enviar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.cancel} onPress={() => setReceiptModal(false)}>
              <Text style={[m.cancelText, { color: t.textSub }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Modificar ── */}
      <Modal visible={modifyModal} animationType="slide" transparent onRequestClose={() => setModifyModal(false)}>
        <View style={m.overlay}>
          <View style={[m.sheet, { backgroundColor: t.bgCard }]}>

            {/* Menu principal */}
            {modifyStep === 'menu' && (
              <>
                <Text style={[m.title, { color: t.text }]}>Modificar Pedido</Text>
                <TouchableOpacity style={[m.btn, { backgroundColor: t.brand }]} onPress={() => { setNewDelivery(order.deliveryOption); setModifyStep('type'); }}>
                  <Text style={m.btnText}>🚚 Alterar Tipo de Pedido</Text>
                </TouchableOpacity>
                {order.deliveryOption === 'DELIVERY' && (
                  <TouchableOpacity style={[m.btn, { backgroundColor: '#2563eb' }]} onPress={() => setModifyStep('schedule')}>
                    <Text style={m.btnText}>🕐 Mudar Horário da Entrega</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[m.btn, { backgroundColor: '#7c3aed' }]} onPress={() => setModifyStep('ingredients')}>
                  <Text style={m.btnText}>🌭 Alterar Ingredientes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.cancel} onPress={() => setModifyModal(false)}>
                  <Text style={[m.cancelText, { color: t.textSub }]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Alterar tipo */}
            {modifyStep === 'type' && (
              <ScrollView>
                <Text style={[m.title, { color: t.text }]}>Tipo de Pedido</Text>
                {(['PICKUP','DELIVERY','DONATE'] as const).map(opt => (
                  <TouchableOpacity key={opt} onPress={() => setNewDelivery(opt)}
                    style={[m.optCard, { borderColor: newDelivery === opt ? t.brand : t.border, backgroundColor: newDelivery === opt ? t.brand + '22' : t.bg }]}>
                    <Text style={[m.optLabel, { color: newDelivery === opt ? t.brand : t.text }]}>
                      {opt === 'PICKUP' ? '🏪 Retirada no Local' : opt === 'DELIVERY' ? '🛵 Entrega' : '🤝 Doação'}
                    </Text>
                  </TouchableOpacity>
                ))}

                {newDelivery === 'DELIVERY' && (
                  <>
                    <Text style={[m.fieldLabel, { color: t.textSub }]}>Endereço</Text>
                    {(order.customer?.addresses ?? []).map(addr => (
                      <TouchableOpacity key={addr.id} onPress={() => setSelectedAddressId(addr.id)}
                        style={[m.optCard, { borderColor: selectedAddressId === addr.id ? t.brand : t.border, backgroundColor: selectedAddressId === addr.id ? t.brand + '22' : t.bg }]}>
                        <Text style={[m.optLabel, { color: t.text }]}>{addr.street}, {addr.number} — {addr.neighborhood}</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput style={[m.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
                      placeholder="Ou digite novo endereço" placeholderTextColor={t.textMuted}
                      value={newAddress} onChangeText={setNewAddress} />
                    <Text style={[m.fieldLabel, { color: t.textSub }]}>Horário (opcional)</Text>
                    <TextInput style={[m.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
                      placeholder="Ex: 19:00" placeholderTextColor={t.textMuted}
                      value={newTime} onChangeText={setNewTime} />
                  </>
                )}

                {newDelivery === 'DONATE' && (
                  <>
                    <TouchableOpacity onPress={() => setDonationTarget('IVC_INTERNAL')}
                      style={[m.optCard, { borderColor: donationTarget === 'IVC_INTERNAL' ? t.brand : t.border, backgroundColor: donationTarget === 'IVC_INTERNAL' ? t.brand + '22' : t.bg }]}>
                      <Text style={[m.optLabel, { color: t.text }]}>🏛️ IVC escolhe o destino</Text>
                    </TouchableOpacity>
                    {partners.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => setDonationTarget(p.id)}
                        style={[m.optCard, { borderColor: donationTarget === p.id ? t.brand : t.border, backgroundColor: donationTarget === p.id ? t.brand + '22' : t.bg }]}>
                        <Text style={[m.optLabel, { color: t.text }]}>🤲 {p.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                <TouchableOpacity style={[m.btn, { backgroundColor: t.brand, marginTop: 8 }]} onPress={saveDeliveryType} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>Salvar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={m.cancel} onPress={() => setModifyStep('menu')}>
                  <Text style={[m.cancelText, { color: t.textSub }]}>Voltar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Mudar horário */}
            {modifyStep === 'schedule' && (
              <>
                <Text style={[m.title, { color: t.text }]}>Horário da Entrega</Text>
                <Text style={[m.fieldLabel, { color: t.textSub }]}>Horário agendado</Text>
                <TextInput style={[m.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
                  placeholder="Ex: 19:00" placeholderTextColor={t.textMuted}
                  value={newTime} onChangeText={setNewTime} />
                <TouchableOpacity style={[m.btn, { backgroundColor: t.brand }]} onPress={saveSchedule} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>Salvar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={m.cancel} onPress={() => setModifyStep('menu')}>
                  <Text style={[m.cancelText, { color: t.textSub }]}>Voltar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Alterar ingredientes — lista de items */}
            {modifyStep === 'ingredients' && !editingItemId && (
              <>
                <Text style={[m.title, { color: t.text }]}>Selecione o Dogão</Text>
                {order.items.map((item, i) => {
                  const label = item.removedIngredients.length > 0 ? `Sem ${item.removedIngredients.join(', ')}` : 'Dogão Completo';
                  return (
                    <TouchableOpacity key={item.id} style={[m.optCard, { borderColor: t.border, backgroundColor: t.bg }]}
                      onPress={() => { setEditingItemId(item.id); setRemovedIngredients([...item.removedIngredients]); }}>
                      <Text style={[m.optLabel, { color: t.text }]}>🌭 {i+1}. {label}</Text>
                      <Text style={[m.optSub, { color: t.brand }]}>Modificar →</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity style={m.cancel} onPress={() => setModifyStep('menu')}>
                  <Text style={[m.cancelText, { color: t.textSub }]}>Voltar</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Alterar ingredientes — modal de ingredientes */}
            {modifyStep === 'ingredients' && !!editingItemId && (
              <ScrollView>
                <Text style={[m.title, { color: t.text }]}>Remover Ingredientes</Text>
                <Text style={[m.fieldLabel, { color: t.textSub }]}>Toque para remover</Text>
                <View style={m.ingGrid}>
                  {INGREDIENTS.map(ing => {
                    const removed = removedIngredients.includes(ing);
                    return (
                      <TouchableOpacity key={ing}
                        style={[m.ingBtn, removed ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : { borderColor: '#16a34a', backgroundColor: '#f0fdf4' }]}
                        onPress={() => setRemovedIngredients(p => p.includes(ing) ? p.filter(x => x !== ing) : [...p, ing])}>
                        <Text style={[m.ingText, { color: removed ? '#dc2626' : '#16a34a', textDecorationLine: removed ? 'line-through' : 'none' }]}>{ing}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={[m.btn, { backgroundColor: t.brand, marginTop: 8 }]} onPress={saveIngredients} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.btnText}>Salvar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={m.cancel} onPress={() => setEditingItemId(null)}>
                  <Text style={[m.cancelText, { color: t.textSub }]}>Voltar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection:'row', alignItems:'center', paddingTop:56, paddingBottom:16, paddingHorizontal:16 },
  backBtn: { width:40, height:40, justifyContent:'center' },
  backIcon: { fontSize:22, color:'#fff' },
  headerTitle: { flex:1, textAlign:'center', fontSize:17, fontWeight:'700', color:'#fff' },
  scroll: { padding:16, gap:12, paddingBottom:40 },
  statusBadge: { borderRadius:99, paddingHorizontal:16, paddingVertical:8, alignSelf:'center' },
  statusText: { fontSize:14, fontWeight:'700' },
  section: { borderRadius:16, padding:16, gap:2 },
  sectionTitle: { fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginBottom:8 },
  itemRow: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemQty: { fontSize:14, fontWeight:'800', width:28 },
  itemName: { flex:1, fontSize:13, fontWeight:'600' },
  itemPrice: { fontSize:13 },
  totalRow: { flexDirection:'row', justifyContent:'space-between', paddingTop:12, borderTopWidth:1, marginTop:4 },
  totalLabel: { fontSize:14, fontWeight:'700' },
  totalValue: { fontSize:22, fontWeight:'900' },
  actions: { flexDirection:'row', gap:10 },
  actionBtn: { flex:1, borderRadius:14, paddingVertical:16, alignItems:'center' },
  actionBtnText: { color:'#fff', fontSize:15, fontWeight:'700' },
});

const r = StyleSheet.create({
  row: { flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:StyleSheet.hairlineWidth },
  label: { fontSize:13 },
  value: { fontSize:13, fontWeight:'600', textAlign:'right', flex:1, marginLeft:16 },
});

const m = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet: { borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40, gap:12, maxHeight:'85%' },
  title: { fontSize:20, fontWeight:'800', marginBottom:4 },
  btn: { borderRadius:14, paddingVertical:15, alignItems:'center' },
  btnText: { color:'#fff', fontSize:15, fontWeight:'700' },
  cancel: { paddingVertical:12, alignItems:'center' },
  cancelText: { fontSize:14, fontWeight:'600' },
  optCard: { borderWidth:2, borderRadius:14, padding:14, marginBottom:8 },
  optLabel: { fontSize:14, fontWeight:'600' },
  optSub: { fontSize:12, fontWeight:'700', marginTop:2 },
  fieldLabel: { fontSize:11, fontWeight:'700', textTransform:'uppercase', letterSpacing:1, marginBottom:6, marginTop:8 },
  input: { borderWidth:1, borderRadius:14, padding:14, fontSize:15, marginBottom:4 },
  ingGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginVertical:8 },
  ingBtn: { borderWidth:2, borderRadius:12, paddingHorizontal:12, paddingVertical:8 },
  ingText: { fontSize:12, fontWeight:'700' },
});
