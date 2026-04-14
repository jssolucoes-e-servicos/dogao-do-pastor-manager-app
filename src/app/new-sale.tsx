import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
  Modal, FlatList, Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Toast } from '@/components/toast';

// ─── Constants ────────────────────────────────────────────────────────────────

const INGREDIENTS = [
  'Batata Palha','Catchup','Ervilha','Maionese','Milho',
  'Molho Vermelho','Molho 4 queijos','Mostarda','Pão','Salsicha',
];

const PAYMENT_METHODS = [
  { value: 'PIX',         label: 'PIX (QR Code)',       icon: '📱' },
  { value: 'CARD_CREDIT', label: 'Cartão (Link Online)', icon: '💳' },
  { value: 'MONEY',       label: 'Dinheiro',             icon: '💵' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'customer' | 'delivery' | 'items' | 'payment' | 'done';

type Customer = { id: string; name: string; phone: string; cpf?: string; addresses?: Address[] };

type Address = { id: string; street: string; number: string; neighborhood: string; city: string; state: string; zipCode: string; complement?: string };

type DeliveryOption = 'PICKUP' | 'DELIVERY' | 'DONATE';

type Partner = { id: string; name: string; addressInLine: string; responsibleName: string; logo?: string };

type PdvItem = { id: string; removedIngredients: string[] };

type PaymentMethod = 'PIX' | 'CARD_CREDIT' | 'MONEY';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}
function formatCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}
function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function groupItems(items: PdvItem[]) {
  const map = new Map<string, { key: string; removed: string[]; count: number }>();
  items.forEach(item => {
    const key = [...item.removedIngredients].sort().join('|') || 'completo';
    if (map.has(key)) map.get(key)!.count++;
    else map.set(key, { key, removed: item.removedIngredients, count: 1 });
  });
  return Array.from(map.values());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={s.stepHeader}>
      <TouchableOpacity style={s.backBtn} onPress={onBack ?? (() => router.back())}>
        <Text style={s.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={s.stepTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function IngredientModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void; onSave: (removed: string[]) => void;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  function toggle(ing: string) {
    setRemoved(p => p.includes(ing) ? p.filter(i => i !== ing) : [...p, ing]);
  }
  function save() { onSave(removed); setRemoved([]); onClose(); }
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Monte seu Dogão</Text>
          <Text style={s.modalSub}>Selecione para <Text style={{ color: '#dc2626', fontWeight: '700' }}>remover</Text>{removed.length === 0 ? ' ou clique em Completo' : ''}</Text>
          <View style={s.ingredientGrid}>
            {INGREDIENTS.map(ing => {
              const isRemoved = removed.includes(ing);
              return (
                <TouchableOpacity
                  key={ing}
                  style={[s.ingredientBtn, isRemoved ? s.ingredientBtnRemoved : s.ingredientBtnPresent]}
                  onPress={() => toggle(ing)}
                >
                  <Text style={[s.ingredientText, isRemoved ? s.ingredientTextRemoved : s.ingredientTextPresent]}>{ing}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.modalActions}>
            <TouchableOpacity style={[s.modalBtnSecondary, { flex: 1 }]} onPress={onClose}>
              <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtnPrimary, { flex: 1 }]} onPress={save}>
              <Text style={s.modalBtnPrimaryText}>
                {removed.length > 0 ? 'Dogão Personalizado' : 'Dogão Completo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PartnerModal({ visible, partners, selectedId, onSelect, onClose }: {
  visible: boolean; partners: Partner[]; selectedId: string | null;
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { maxHeight: '80%' }]}>
          <Text style={s.modalTitle}>Escolher Instituição</Text>
          <TextInput style={[s.input, { marginBottom: 8 }]} placeholder="Buscar..." value={search} onChangeText={setSearch} />
          <FlatList
            data={filtered}
            keyExtractor={p => p.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.partnerRow, selectedId === item.id && s.partnerRowActive]}
                onPress={() => { onSelect(item.id); onClose(); }}
              >
                <View style={s.partnerInfo}>
                  <Text style={s.partnerName}>{item.name}</Text>
                  <Text style={s.partnerAddr}>{item.addressInLine}</Text>
                </View>
                {selectedId === item.id && <Text style={{ color: '#ea580c' }}>✓</Text>}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={[s.modalBtnSecondary, { marginTop: 8 }]} onPress={onClose}>
            <Text style={s.modalBtnSecondaryText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PixModal({ visible, pixData, onConfirm, onClose, onSendCode, polling, generating }: {
  visible: boolean;
  pixData: { qrCodeBase64: string; pixCopyPaste: string; orderId: string } | null;
  onConfirm: () => void;
  onClose: () => void;
  onSendCode: () => void;
  polling: boolean;
  generating: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (pixData?.pixCopyPaste) {
      Clipboard.setStringAsync(pixData.pixCopyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSendCode() {
    setSending(true);
    try {
      await onSendCode();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => {}}>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { alignItems: 'center' }]}>
          <Text style={s.modalTitle}>Pagamento PIX</Text>

          {generating && (
            <View style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
              <ActivityIndicator color="#ea580c" size="large" />
              <Text style={s.modalSub}>Gerando QR Code...</Text>
            </View>
          )}

          {!generating && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <ActivityIndicator color="#ea580c" size="small" />
                <Text style={s.modalSub}>Aguardando confirmação de pagamento...</Text>
              </View>

              {pixData?.qrCodeBase64 ? (
                <Image source={{ uri: `data:image/png;base64,${pixData.qrCodeBase64}` }} style={s.qrCode} resizeMode="contain" />
              ) : null}

              {pixData?.pixCopyPaste ? (
                <TouchableOpacity style={s.copyBox} onPress={handleCopy} activeOpacity={0.7}>
                  <Text style={s.copyText} numberOfLines={3}>{pixData.pixCopyPaste}</Text>
                  <Text style={s.copyHint}>{copied ? '✓ Copiado!' : 'Toque para copiar'}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[s.modalBtnPrimary, { marginTop: 16, width: '100%' }, sending && s.btnDisabled]}
                onPress={handleSendCode}
                disabled={sending}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.modalBtnPrimaryText}>Enviar código para o cliente</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={[s.modalBtnSecondary, { marginTop: 8, width: '100%' }]} onPress={onClose}>
                <Text style={s.modalBtnSecondaryText}>Fechar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function CashModal({ visible, total, onFinalize, onClose }: {
  visible: boolean; total: number; onFinalize: (received: number) => void; onClose: () => void;
}) {
  const [received, setReceived] = useState('');
  const receivedNum = parseFloat(received.replace(',', '.')) || 0;
  const change = receivedNum - total;
  const canFinalize = receivedNum >= total;
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Pagamento em Dinheiro</Text>
          <Text style={s.modalSub}>Total: {formatCurrency(total)}</Text>
          <Text style={s.label}>Valor Recebido</Text>
          <TextInput
            style={s.input}
            placeholder="0,00"
            keyboardType="decimal-pad"
            value={received}
            onChangeText={setReceived}
          />
          {receivedNum > total && (
            <View style={s.changeBox}>
              <Text style={s.changeSub}>Troco a Devolver</Text>
              <Text style={s.changeValue}>{formatCurrency(change)}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[s.modalBtnPrimary, { marginTop: 16 }, !canFinalize && s.btnDisabled]}
            onPress={() => canFinalize && onFinalize(receivedNum)}
            disabled={!canFinalize}
          >
            <Text style={s.modalBtnPrimaryText}>Finalizar Venda</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modalBtnSecondary, { marginTop: 8 }]} onPress={onClose}>
            <Text style={s.modalBtnSecondaryText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NewSaleScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Edition
  const [dogPrice, setDogPrice] = useState(24.99);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' as 'error' | 'success' });
  function showError(msg: string) { setToast({ visible: true, message: msg, type: 'error' }); }
  function showSuccess(msg: string) { setToast({ visible: true, message: msg, type: 'success' }); }

  // Step
  const [step, setStep] = useState<Step>('customer');

  // Customer
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [name, setName] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Delivery
  const [delivery, setDelivery] = useState<DeliveryOption>('PICKUP');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  // Donation
  const [donationTarget, setDonationTarget] = useState<'IVC_INTERNAL' | string>('IVC_INTERNAL');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerModalVisible, setPartnerModalVisible] = useState(false);

  // Items
  const [items, setItems] = useState<PdvItem[]>([]);
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);

  // Payment modals
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixData, setPixData] = useState<{ qrCodeBase64: string; pixCopyPaste: string; orderId: string } | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null); // pedido PIX já criado
  const [pixPolling, setPixPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cashModalVisible, setCashModalVisible] = useState(false);

  const total = items.length * dogPrice;
  const grouped = groupItems(items);

  // Load edition price and partners
  useEffect(() => {
    api.get<{ edition: { dogPrice: number } }>('/editions/get-active')
      .then(res => { if (res?.edition?.dogPrice) setDogPrice(res.edition.dogPrice); })
      .catch(() => {});
    api.get<Partner[]>('/partners/for-orders')
      .then(res => { if (Array.isArray(res)) setPartners(res); })
      .catch(() => {});
  }, []);

  // ── Customer lookup ──────────────────────────────────────────────────────

  async function lookupByPhone() {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return;
    setLookingUp(true);
    try {
      const customer = await api.get<Customer | null>(`/customers/by-phone/${clean}`);
      if (customer?.id) {
        setFoundCustomer(customer);
        setName(customer.name);
        if (customer.cpf) setCpf(formatCPF(customer.cpf));

        // Verificar se tem pedido pendente na edição ativa
        try {
          const pending = await api.get<any>(`/orders/pending-pdv/${customer.id}`);
          if (pending?.id) {
            setPendingOrderId(pending.id);

            // Pré-carregar itens do pedido pendente
            if (Array.isArray(pending.items) && pending.items.length > 0) {
              setItems(pending.items.map((it: any) => ({
                id: it.id,
                removedIngredients: it.removedIngredients ?? [],
              })));
            }

            // Pré-carregar tipo de entrega
            if (pending.deliveryOption) setDelivery(pending.deliveryOption);
            if (pending.addressId) setSelectedAddressId(pending.addressId);

            // Pré-carregar dados PIX se tiver pagamento pendente
            const pixPayment = pending.payments?.find((p: any) => p.method === 'PIX' && p.status === 'PENDING' && p.pixCopyPaste);
            if (pixPayment) {
              setPixData({
                qrCodeBase64: pixPayment.pixQrcode ?? '',
                pixCopyPaste: pixPayment.pixCopyPaste ?? '',
                orderId: pending.id,
              });
            }

            showSuccess(`Pedido pendente recuperado (${pending.items?.length ?? 0} dogão${pending.items?.length !== 1 ? 's' : ''})`);
          }
        } catch { /* sem pedido pendente, tudo bem */ }
      }
    } catch { /* cliente não encontrado */ }
    finally { setLookingUp(false); }
  }

  function submitCustomer() {
    if (phone.replace(/\D/g, '').length < 10) { showError('Telefone inválido.'); return; }
    if (!name.trim()) { showError('Nome é obrigatório.'); return; }
    setStep('delivery');
  }

  // ── Items ────────────────────────────────────────────────────────────────

  function addItem(removed: string[]) {
    setItems(prev => [...prev, { id: Math.random().toString(36).slice(2), removedIngredients: removed }]);
    showSuccess('Item adicionado!');
  }

  function removeOneFromGroup(key: string) {
    setItems(prev => {
      const idx = [...prev].reverse().findIndex(i => {
        const k = [...i.removedIngredients].sort().join('|') || 'completo';
        return k === key;
      });
      if (idx === -1) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.filter((_, i) => i !== realIdx);
    });
  }

  // ── Submit order ─────────────────────────────────────────────────────────

  async function submitOrder(method: PaymentMethod) {
    if (items.length === 0) { showError('Adicione pelo menos 1 dogão.'); return; }
    setPaymentMethod(method);

    // Se está trocando de método (tinha PIX pendente e escolheu outro), limpa o pixData
    if (pendingOrderId && method !== 'PIX' && pixData) {
      setPixData(null);
    }

    // PIX: abre modal imediatamente, gera QR dentro
    if (method === 'PIX') {
      setPixModalVisible(true);
      setLoading(true);
      try {
        let result: any;

        // Se já existe pedido PIX pendente, buscar do banco (reusar QR existente)
        if (pendingOrderId) {
          result = await api.get<any>(`/orders/${pendingOrderId}`);
        } else {
          const sellerId = getEffectiveSellerId();
          const dto = buildDto(method, sellerId);
          result = await api.post<any>('/orders/create-pdv', dto);
        }

        // createPDV retorna OrderEntity diretamente (com payments[])
        const payment = result?.payments?.[0];
        const orderId = result?.id ?? '';
        setPixData({
          qrCodeBase64: payment?.pixQrcode ?? '',
          pixCopyPaste: payment?.pixCopyPaste ?? '',
          orderId,
        });
        setPendingOrderId(orderId);
        if (payment?.id) startPixPolling(payment.id);
      } catch (e: any) {
        setPixModalVisible(false);
        showError(e?.message ?? 'Erro ao gerar PIX.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // MONEY: cria pedido e abre modal de troco
    if (method === 'MONEY') {
      setLoading(true);
      try {
        const sellerId = getEffectiveSellerId();
        const dto = buildDto(method, sellerId);
        await api.post<any>('/orders/create-pdv', dto);
        setCashModalVisible(true);
      } catch (e: any) {
        showError(e?.message ?? 'Erro ao criar pedido.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // CARD_CREDIT: cria pedido, link enviado por WhatsApp
    setLoading(true);
    try {
      const sellerId = getEffectiveSellerId();
      const dto = buildDto(method, sellerId);
      await api.post<any>('/orders/create-pdv', dto);
      showSuccess('Pedido criado! Link de pagamento enviado por WhatsApp.');
      setStep('done');
    } catch (e: any) {
      showError(e?.message ?? 'Erro ao criar pedido.');
    } finally {
      setLoading(false);
    }
  }

  // Seller direto > seller padrão da célula
  function getEffectiveSellerId(): string | undefined {
    return user?.sellers?.[0]?.id
      ?? user?.cellsMember?.[0]?.sellerId;
  }

  function getEffectiveSellerName(): string {
    if (user?.sellers?.[0]) {
      return (user.sellers[0] as any).name ?? user.sellers[0].tag ?? '—';
    }
    return '—';
  }

  function buildDto(method: PaymentMethod, sellerId?: string) {
    return {
      customerName: name.trim(),
      customerPhone: phone.replace(/\D/g, ''),
      customerCpf: cpf.replace(/\D/g, '') || undefined,
      paymentMethod: method,
      deliveryOption: delivery,
      totalValue: total,
      sellerId: sellerId ?? undefined,
      contributorId: user?.id,  // quem está vendendo (para Minhas Vendas)
      items: items.map(i => ({ productId: 'dogao', removedIngredients: i.removedIngredients })),
      ...(delivery === 'DELIVERY' && selectedAddressId ? { addressId: selectedAddressId } : {}),
      ...(delivery === 'DELIVERY' && !selectedAddressId && newAddress ? { address: newAddress } : {}),
      ...(delivery === 'DELIVERY' && scheduledTime ? { scheduledTime } : {}),
      ...(delivery === 'DONATE' ? { observations: donationTarget === 'IVC_INTERNAL' ? 'IVC_INTERNAL' : `PARTNER:${donationTarget}` } : {}),
    };
  }

  // ── PIX Polling ──────────────────────────────────────────────────────────

  function startPixPolling(paymentId: string) {
    setPixPolling(true);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ status: string }>(`/payments/${paymentId}`);
        if (res?.status === 'PAID') {
          stopPolling();
          setPixModalVisible(false);
          showSuccess('Pagamento confirmado!');
          setStep('done');
        }
      } catch { /* ignore */ }
    }, 5000);
  }

  function stopPolling() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setPixPolling(false);
  }

  function handlePixConfirm() { stopPolling(); setPixModalVisible(false); setPendingOrderId(null); setStep('done'); }
  function handlePixClose() {
    stopPolling();
    setPixModalVisible(false);
    // Volta para o step de pagamento — vendedor pode trocar método ou confirmar
    setStep('payment');
  }

  async function handleSendPixCode() {
    if (!pixData?.orderId) return;
    try {
      await api.post(`/orders/${pixData.orderId}/send-pix-code`, {});
      showSuccess('Código PIX enviado por WhatsApp!');
    } catch {
      showError('Erro ao enviar código PIX.');
    }
  }

  function handleCashFinalize() { setCashModalVisible(false); setStep('done'); }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={() => setToast(t => ({ ...t, visible: false }))} />

      <IngredientModal visible={ingredientModalVisible} onClose={() => setIngredientModalVisible(false)} onSave={addItem} />
      <PartnerModal visible={partnerModalVisible} partners={partners} selectedId={donationTarget === 'IVC_INTERNAL' ? null : donationTarget} onSelect={setDonationTarget} onClose={() => setPartnerModalVisible(false)} />
      <PixModal visible={pixModalVisible} pixData={pixData} onConfirm={handlePixConfirm} onClose={handlePixClose} onSendCode={handleSendPixCode} polling={pixPolling} generating={loading} />
      <CashModal visible={cashModalVisible} total={total} onFinalize={handleCashFinalize} onClose={() => setCashModalVisible(false)} />

      {/* STEP: customer */}
      {step === 'customer' && (
        <>
          <StepHeader title="Dados do Cliente" />
          <View style={s.sellerBadge}>
            <Text style={s.sellerBadgeText}>🏷️ Vendedor: {getEffectiveSellerName()}</Text>
          </View>
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.label}>Telefone *</Text>
            <View style={s.row}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="(00) 00000-0000" keyboardType="phone-pad"
                value={phone} onChangeText={v => setPhone(formatPhone(v))} onBlur={lookupByPhone} />
              {lookingUp && <ActivityIndicator color="#ea580c" style={{ marginLeft: 8 }} />}
            </View>
            {foundCustomer && <Text style={s.hint}>✓ Cliente encontrado: {foundCustomer.name}</Text>}
            {pendingOrderId && <Text style={[s.hint, { color: '#ea580c' }]}>⚠ Pedido pendente recuperado — itens e pagamento pré-carregados</Text>}

            <Text style={s.label}>CPF (opcional)</Text>
            <TextInput style={s.input} placeholder="000.000.000-00" keyboardType="numeric"
              value={cpf} onChangeText={v => setCpf(formatCPF(v))} />

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} placeholder="Nome completo" value={name}
              onChangeText={setName} autoCapitalize="words" />

            <TouchableOpacity style={s.btn} onPress={submitCustomer}>
              <Text style={s.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}

      {/* STEP: delivery */}
      {step === 'delivery' && (
        <>
          <StepHeader title="Tipo de Pedido" onBack={() => setStep('customer')} />
          <ScrollView contentContainerStyle={s.scroll}>
            {(['PICKUP', 'DELIVERY', 'DONATE'] as DeliveryOption[]).map(opt => (
              <TouchableOpacity key={opt} style={[s.optionCard, delivery === opt && s.optionCardActive]}
                onPress={() => setDelivery(opt)}>
                <Text style={s.optionIcon}>{opt === 'PICKUP' ? '🏪' : opt === 'DELIVERY' ? '🛵' : '🤝'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, delivery === opt && s.optionLabelActive]}>
                    {opt === 'PICKUP' ? 'Retirada no Local' : opt === 'DELIVERY' ? 'Entrega' : 'Doação'}
                  </Text>
                  <Text style={s.optionSub}>
                    {opt === 'PICKUP' ? 'Cliente retira no balcão'
                      : opt === 'DELIVERY' ? 'Entrega no endereço do cliente'
                      : 'Dogão doado para instituição'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* Delivery: endereços salvos + novo */}
            {delivery === 'DELIVERY' && (
              <View style={{ gap: 8 }}>
                {(foundCustomer?.addresses ?? []).length > 0 && !showNewAddress && (
                  <>
                    <Text style={s.label}>Endereços salvos</Text>
                    {foundCustomer!.addresses!.map(addr => (
                      <TouchableOpacity key={addr.id}
                        style={[s.addressCard, selectedAddressId === addr.id && s.addressCardActive]}
                        onPress={() => setSelectedAddressId(addr.id)}>
                        <Text style={s.addressText}>{addr.street}, {addr.number} — {addr.neighborhood}</Text>
                        <Text style={s.addressSub}>{addr.city}/{addr.state}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.linkBtn} onPress={() => { setShowNewAddress(true); setSelectedAddressId(null); }}>
                      <Text style={s.linkBtnText}>+ Novo endereço</Text>
                    </TouchableOpacity>
                  </>
                )}
                {((foundCustomer?.addresses ?? []).length === 0 || showNewAddress) && (
                  <>
                    <Text style={s.label}>Endereço de entrega</Text>
                    <TextInput style={s.input} placeholder="Rua, número, bairro, cidade"
                      value={newAddress} onChangeText={setNewAddress} />
                    <Text style={s.label}>Horário agendado (opcional)</Text>
                    <TextInput style={s.input} placeholder="Ex: 19:00" value={scheduledTime} onChangeText={setScheduledTime} />
                    {(foundCustomer?.addresses ?? []).length > 0 && (
                      <TouchableOpacity style={s.linkBtn} onPress={() => setShowNewAddress(false)}>
                        <Text style={s.linkBtnText}>← Usar endereço salvo</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Donation: IVC ou Parceiro */}
            {delivery === 'DONATE' && (
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[s.optionCard, donationTarget === 'IVC_INTERNAL' && s.optionCardActive]}
                  onPress={() => setDonationTarget('IVC_INTERNAL')}>
                  <Text style={s.optionIcon}>🏛️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionLabel, donationTarget === 'IVC_INTERNAL' && s.optionLabelActive]}>A IVC escolhe o destino</Text>
                    <Text style={s.optionSub}>Nossa equipe escolhe conforme a necessidade</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.optionCard, donationTarget !== 'IVC_INTERNAL' && s.optionCardActive]}
                  onPress={() => setPartnerModalVisible(true)}>
                  <Text style={s.optionIcon}>🤲</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionLabel, donationTarget !== 'IVC_INTERNAL' && s.optionLabelActive]}>Escolher Instituição</Text>
                    <Text style={s.optionSub}>
                      {donationTarget !== 'IVC_INTERNAL'
                        ? partners.find(p => p.id === donationTarget)?.name ?? 'Selecionado'
                        : 'Selecionar da lista de parceiros'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={s.btn} onPress={() => setStep('items')}>
              <Text style={s.btnText}>Continuar →</Text>
            </TouchableOpacity>
          </ScrollView>
        </>
      )}

      {/* STEP: items */}
      {step === 'items' && (
        <>
          <StepHeader title="Monte o Pedido" onBack={() => setStep('delivery')} />
          <ScrollView contentContainerStyle={s.scroll}>
            <View style={s.itemsSummary}>
              <Text style={s.itemsCount}>{items.length} dogão{items.length !== 1 ? 's' : ''}</Text>
              <Text style={s.itemsTotal}>{formatCurrency(total)}</Text>
            </View>

            {grouped.map(g => (
              <View key={g.key} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>🌭 Dogão {g.removed.length > 0 ? `(sem: ${g.removed.join(', ')})` : 'Completo'}</Text>
                  <Text style={s.itemPrice}>{formatCurrency(dogPrice)} cada</Text>
                </View>
                <View style={s.qtyControls}>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => removeOneFromGroup(g.key)}>
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.qtyNum}>{g.count}</Text>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => addItem(g.removed)}>
                    <Text style={s.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={s.addItemBtn} onPress={() => setIngredientModalVisible(true)}>
              <Text style={s.addItemBtnText}>+ Adicionar Dogão</Text>
            </TouchableOpacity>

            {items.length > 0 && (
              <TouchableOpacity style={s.btn} onPress={() => setStep('payment')}>
                <Text style={s.btnText}>Continuar →</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      {/* STEP: payment */}
      {step === 'payment' && (
        <>
          <StepHeader title="Pagamento" onBack={() => setStep('items')} />
          <ScrollView contentContainerStyle={s.scroll}>
            <Text style={s.summaryText}>{items.length} dogão{items.length !== 1 ? 's' : ''} · {formatCurrency(total)}</Text>

            {pendingOrderId && (
              <View style={s.pendingBanner}>
                <Text style={s.pendingBannerText}>⏳ Pedido criado — aguardando pagamento</Text>
                <Text style={s.pendingBannerSub}>Troque o método abaixo ou confirme para ir às vendas</Text>
              </View>
            )}

            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[s.optionCard, paymentMethod === m.value && s.optionCardActive, loading && s.btnDisabled]}
                onPress={() => !loading && submitOrder(m.value as PaymentMethod)}
                disabled={loading}
              >
                <Text style={s.optionIcon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionLabel, paymentMethod === m.value && s.optionLabelActive]}>{m.label}</Text>
                  {pendingOrderId && paymentMethod === m.value && (
                    <Text style={s.optionSub}>método atual — toque para reabrir</Text>
                  )}
                </View>
                {loading && paymentMethod === m.value
                  ? <ActivityIndicator color="#ea580c" />
                  : <Text style={{ color: '#9ca3af', fontSize: 18 }}>→</Text>
                }
              </TouchableOpacity>
            ))}

            {pendingOrderId && (
              <TouchableOpacity style={[s.btn, { backgroundColor: '#6b7280' }]} onPress={() => router.replace('/(drawer)/(tabs)/sales')}>
                <Text style={s.btnText}>Ver em Minhas Vendas</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      {/* STEP: done */}
      {step === 'done' && (
        <View style={s.doneContainer}>
          <Text style={{ fontSize: 72 }}>✅</Text>
          <Text style={s.doneTitle}>Venda Registrada!</Text>
          <Text style={s.doneSub}>O cliente receberá a confirmação pelo WhatsApp.</Text>
          <TouchableOpacity style={[s.btn, { width: '80%', marginTop: 32 }]} onPress={() => router.back()}>
            <Text style={s.btnText}>Voltar ao Início</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneTitle: { fontSize: 26, fontWeight: 'bold', color: '#1f2937', marginTop: 16 },
  doneSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8 },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ea580c', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#fff' },
  stepTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },
  sellerBadge: { backgroundColor: '#fff7ed', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#fed7aa' },
  sellerBadgeText: { fontSize: 13, color: '#ea580c', fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  hint: { fontSize: 12, color: '#16a34a', marginTop: -4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1f2937',
  },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 2, borderColor: '#e5e7eb',
  },
  optionCardActive: { borderColor: '#ea580c', backgroundColor: '#fff7ed' },
  optionIcon: { fontSize: 26 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  optionLabelActive: { color: '#ea580c' },
  optionSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  addressCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 2, borderColor: '#e5e7eb',
  },
  addressCardActive: { borderColor: '#ea580c', backgroundColor: '#fff7ed' },
  addressText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  addressSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  linkBtn: { paddingVertical: 8 },
  linkBtnText: { color: '#ea580c', fontWeight: '600', fontSize: 14 },

  itemsSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemsCount: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  itemsTotal: { fontSize: 20, fontWeight: 'bold', color: '#ea580c' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  itemPrice: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ea580c', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 20, color: '#fff', lineHeight: 24 },
  qtyNum: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', minWidth: 24, textAlign: 'center' },
  addItemBtn: {
    borderWidth: 2, borderColor: '#ea580c', borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  addItemBtnText: { color: '#ea580c', fontWeight: '700', fontSize: 15 },

  summaryText: { fontSize: 15, fontWeight: '600', color: '#374151', textAlign: 'center' },

  pendingBanner: { backgroundColor: '#fff7ed', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fed7aa' },
  pendingBannerText: { fontSize: 14, fontWeight: '700', color: '#ea580c' },
  pendingBannerSub: { fontSize: 12, color: '#9a3412', marginTop: 2 },

  btn: { backgroundColor: '#ea580c', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937', textAlign: 'center' },
  modalSub: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnPrimary: { backgroundColor: '#ea580c', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalBtnSecondary: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalBtnSecondaryText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },

  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ingredientBtn: {
    width: '47%', paddingVertical: 14, borderRadius: 14,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  ingredientBtnPresent: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  ingredientBtnRemoved: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  ingredientText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  ingredientTextPresent: { color: '#16a34a' },
  ingredientTextRemoved: { color: '#dc2626', textDecorationLine: 'line-through' },

  partnerRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  partnerRowActive: { backgroundColor: '#fff7ed' },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  partnerAddr: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  qrCode: { width: 200, height: 200 },
  copyBox: { backgroundColor: '#f3f4f6', borderRadius: 10, padding: 12, width: '100%' },
  copyText: { fontSize: 11, color: '#374151', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  copyHint: { fontSize: 11, color: '#ea580c', fontWeight: '600', marginTop: 6, textAlign: 'center' },

  changeBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, alignItems: 'center' },
  changeSub: { fontSize: 11, fontWeight: '800', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1 },
  changeValue: { fontSize: 28, fontWeight: 'bold', color: '#16a34a', marginTop: 4 },
});
