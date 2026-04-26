import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput, FlatList,
} from 'react-native';
import { alerts } from '@/lib/alerts';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Seller = { id: string; tag: string; name?: string };
type Member = { id: string; name: string; username?: string; phone?: string };
type Order = {
  id: string; customerName: string; totalValue: number;
  paymentStatus: string; paymentType: string; createdAt: string;
  items: { id: string }[]; sellerTag: string; origin: string;
};
type Cell = {
  id: string; name: string;
  leader?: { name: string };
  network?: { name: string };
  sellers?: Seller[];
  contributors?: Member[];
};

const PAYMENT_LABEL: Record<string,string> = { PIX:'PIX', CARD_CREDIT:'Cartão', MONEY:'Dinheiro', UNDEFINED:'—' };
const ORIGIN_LABEL: Record<string,string> = { SITE:'Site', APP:'App', PDV:'PDV', MANUAL:'Manual' };

function fmt(v: number) { return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }

export default function MyCellScreen() {
  const { user } = useAuth();
  const { colors: t } = useTheme();
  const router = useRouter();
  const [cell, setCell] = useState<Cell | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [salesModal, setSalesModal] = useState(false);
  const [membersModal, setMembersModal] = useState(false);
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [debtModal, setDebtModal] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [cellSettlements, setCellSettlements] = useState<any[]>([]);

  // Gera username a partir do nome: primeiro + último, minúsculo, sem espaços/acentos
  function generateUsername(name: string): string {
    const parts = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return parts[0] + parts[parts.length - 1];
  }

  async function load() {
    setLoading(true);
    try {
      let cellData: Cell | null = null;

      if ((user?.cells?.length ?? 0) > 0) {
        cellData = await api.get<Cell>(`/cells/by-leader/${user!.id}`);
      } else {
        const cellId = user?.sellers?.[0]?.cellId ?? user?.cellsMember?.[0]?.cellId;
        if (cellId) cellData = await api.get<Cell>(`/cells/show/${cellId}`);
      }

      setCell(cellData);

      if (cellData?.id) {
        // Busca vendas da célula (todos os sellers)
        const sellerIds = (cellData.sellers ?? []).map(s => s.id);
        if (sellerIds.length > 0) {
          const res = await api.get<any>(`/orders?perPage=100`);
          const all: Order[] = res?.data ?? (Array.isArray(res) ? res : []);
          const cellOrders = all.filter((o: any) =>
            sellerIds.some(sid => o.sellerId === sid) || o.seller?.cellId === cellData!.id
          );
          setOrders(cellOrders);
        }

        // Busca acertos da célula
        try {
          const settlements = await api.get<any[]>(`/cash-settlements/cell/${cellData.id}`);
          setCellSettlements(Array.isArray(settlements) ? settlements : []);
        } catch { setCellSettlements([]); }
      }
    } catch (e: any) {
      setCell(null);
    } finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  async function handleAddMember() {
    if (!memberForm.name || !memberForm.phone) {
      alerts.alert('Preencha nome e telefone'); return;
    }
    const username = generateUsername(memberForm.name);
    if (!username) { alerts.alert('Nome inválido'); return; }
    setSaving(true);
    try {
      await api.post('/contributors/invite-member', {
        name: memberForm.name,
        username,
        phone: memberForm.phone,
        cellId: cell?.id,
      });
      alerts.alert('Sucesso!', `${memberForm.name} adicionado à célula.\nUsuário: @${username}\nUma mensagem de boas-vindas foi enviada por WhatsApp.`);
      setAddMemberModal(false);
      setMemberForm({ name: '', phone: '' });
      load();
    } catch (e: any) { alerts.error(e.message); }
    setSaving(false);
  }

  const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
  const totalDogs = paidOrders.reduce((a, o) => a + (o.items?.length || 0), 0);
  const pendingOrders = orders.filter(o => o.paymentStatus === 'PENDING');

  // Dívida total: soma dos saldos pendentes de acerto de todos os membros
  const totalDebt = cellSettlements.reduce((a: number, s: any) => {
    const balance = (s.totalAmount ?? 0) - (s.paidAmount ?? 0);
    return a + Math.max(0, balance);
  }, 0);

  // Pendências por membro (quem tem saldo > 0)
  const debtByMember = cellSettlements
    .map((s: any) => ({
      name: s.contributor?.name ?? '—',
      username: s.contributor?.username ?? '—',
      balance: Math.max(0, (s.totalAmount ?? 0) - (s.paidAmount ?? 0)),
    }))
    .filter(m => m.balance > 0.001)
    .sort((a, b) => b.balance - a.balance);

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <DrawerHeader title="Minha Célula" />
        <View style={s.center}><ActivityIndicator color={t.brand} size="large" /></View>
      </View>
    );
  }

  if (!cell) {
    return (
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <DrawerHeader title="Minha Célula" />
        <View style={s.center}>
          <Text style={[s.empty, { color: t.textMuted }]}>Nenhuma célula encontrada.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Minha Célula" />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Info da célula */}
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          <Text style={[s.cellName, { color: t.brand }]}>{cell.name}</Text>
          {cell.leader && <Text style={[s.sub, { color: t.textSub }]}>Líder: {cell.leader.name}</Text>}
          {cell.network && <Text style={[s.sub, { color: t.textMuted }]}>Rede: {cell.network.name}</Text>}
        </View>

        {/* Métricas */}
        <View style={s.statsRow}>
          <View style={[s.statBox, { backgroundColor: t.brand }]}>
            <Text style={s.statNum}>{totalDogs}</Text>
            <Text style={s.statLabel}>Dogs Vendidos</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: t.bgCard }]}>
            <Text style={[s.statNum, { color: '#d97706' }]}>{pendingOrders.length}</Text>
            <Text style={[s.statLabel, { color: t.textSub }]}>Pendentes</Text>
          </View>
          <View style={[s.statBox, { backgroundColor: totalDebt > 0 ? '#dc262622' : t.bgCard }]}>
            <Text style={[s.statNum, { color: totalDebt > 0 ? '#dc2626' : '#16a34a', fontSize: 15 }]}>
              {fmt(totalDebt).replace('R$\u00a0', '').replace('R$', '')}
            </Text>
            <Text style={[s.statLabel, { color: t.textSub }]}>Dívida</Text>
          </View>
        </View>

        {/* Botões de ação */}
        <View style={s.btnRow}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#ea580c' }]} onPress={() => setSalesModal(true)}>
            <Text style={s.actionBtnText}>🛒 Vendas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#2563eb' }]} onPress={() => setMembersModal(true)}>
            <Text style={s.actionBtnText}>👥 Membros</Text>
          </TouchableOpacity>
        </View>

        {totalDebt > 0 && (
          <TouchableOpacity style={[s.actionBtnFull, { backgroundColor: '#dc2626' }]} onPress={() => setDebtModal(true)}>
            <Text style={s.actionBtnText}>⚠️ Pendências de Acerto ({debtByMember.length} membro{debtByMember.length !== 1 ? 's' : ''})</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.actionBtnFull, { backgroundColor: '#16a34a' }]} onPress={() => setAddMemberModal(true)}>
          <Text style={s.actionBtnText}>➕ Cadastrar / Vincular Membro</Text>
        </TouchableOpacity>

        {/* Vendedores */}
        {(cell.sellers ?? []).length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: t.textMuted }]}>VENDEDORES</Text>
            <View style={[s.card, { backgroundColor: t.bgCard }]}>
              {cell.sellers!.map((seller, i) => (
                <View key={seller.id} style={[s.row, i < cell.sellers!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
                  <View style={[s.tagBadge, { backgroundColor: t.brand + '22' }]}>
                    <Text style={[s.tagText, { color: t.brand }]}>@{seller.tag}</Text>
                  </View>
                  {seller.name && <Text style={[s.rowLabel, { color: t.text }]}>{seller.name}</Text>}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Modal Vendas da Célula ── */}
      <Modal visible={salesModal} animationType="slide" transparent onRequestClose={() => setSalesModal(false)}>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: t.bgCard }]}>
            <View style={mo.header}>
              <Text style={[mo.title, { color: t.text }]}>Vendas da Célula</Text>
              <TouchableOpacity onPress={() => setSalesModal(false)}>
                <Text style={{ fontSize:20, color: t.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {/* Métricas rápidas */}
            <View style={mo.statsRow}>
              <View style={[mo.statBox, { backgroundColor: '#ea580c' }]}>
                <Text style={mo.statNum}>{totalDogs}</Text>
                <Text style={mo.statLabel}>Dogs</Text>
              </View>
              <View style={[mo.statBox, { backgroundColor: t.bg }]}>
                <Text style={[mo.statNum, { color: t.text }]}>{paidOrders.length}</Text>
                <Text style={[mo.statLabel, { color: t.textSub }]}>Pedidos</Text>
              </View>
              <View style={[mo.statBox, { backgroundColor: totalDebt > 0 ? '#dc262622' : t.bg }]}>
                <Text style={[mo.statNum, { color: totalDebt > 0 ? '#dc2626' : '#16a34a', fontSize: 14 }]}>
                  {fmt(totalDebt)}
                </Text>
                <Text style={[mo.statLabel, { color: t.textSub }]}>Dívida</Text>
              </View>
            </View>
            <FlatList
              data={orders}
              keyExtractor={o => o.id}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={<Text style={[mo.empty, { color: t.textMuted }]}>Nenhuma venda encontrada</Text>}
              renderItem={({ item: o }) => {
                const isPaid = o.paymentStatus === 'PAID';
                return (
                  <TouchableOpacity style={[mo.orderRow, { borderBottomColor: t.separator }]}
                    onPress={() => { setSalesModal(false); router.push({ pathname: '/order-detail', params: { id: o.id } }); }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[mo.orderName, { color: t.text }]}>{o.customerName}</Text>
                      <Text style={[mo.orderMeta, { color: t.textMuted }]}>
                        {o.sellerTag} · {ORIGIN_LABEL[o.origin] ?? o.origin} · {fmtDate(o.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[mo.orderValue, { color: t.text }]}>{fmt(o.totalValue)}</Text>
                      <Text style={[mo.orderDogs, { color: '#ea580c' }]}>{o.items?.length ?? 0} 🌭</Text>
                      <View style={[mo.badge, { backgroundColor: (isPaid ? '#16a34a' : '#d97706') + '22' }]}>
                        <Text style={[mo.badgeText, { color: isPaid ? '#16a34a' : '#d97706' }]}>
                          {isPaid ? 'Pago' : 'Pendente'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Modal Membros ── */}
      <Modal visible={membersModal} animationType="slide" transparent onRequestClose={() => setMembersModal(false)}>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: t.bgCard }]}>
            <View style={mo.header}>
              <Text style={[mo.title, { color: t.text }]}>Membros da Célula</Text>
              <TouchableOpacity onPress={() => setMembersModal(false)}>
                <Text style={{ fontSize:20, color: t.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={cell.contributors ?? []}
              keyExtractor={m => m.id}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={<Text style={[mo.empty, { color: t.textMuted }]}>Nenhum membro cadastrado</Text>}
              renderItem={({ item: m }) => (
                <View style={[mo.memberRow, { borderBottomColor: t.separator }]}>
                  <View style={[mo.avatar, { backgroundColor: t.brand }]}>
                    <Text style={mo.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[mo.memberName, { color: t.text }]}>{m.name}</Text>
                    {m.username && <Text style={[mo.memberSub, { color: t.textMuted }]}>@{m.username}</Text>}
                  </View>
                </View>
              )}
            />
            <TouchableOpacity style={[mo.addBtn, { backgroundColor: '#16a34a' }]}
              onPress={() => { setMembersModal(false); setAddMemberModal(true); }}>
              <Text style={mo.addBtnText}>➕ Cadastrar Novo Membro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Cadastrar Membro ── */}
      <Modal visible={addMemberModal} animationType="slide" transparent onRequestClose={() => setAddMemberModal(false)}>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[mo.title, { color: t.text }]}>Cadastrar Membro</Text>
            <Text style={[mo.sub, { color: t.textMuted }]}>Senha padrão: dogao@2026 · Perfil: Vendedor · Boas-vindas via WhatsApp</Text>

            <Text style={[mo.fieldLabel, { color: t.textSub }]}>Nome Completo</Text>
            <TextInput
              style={[mo.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
              placeholder="Nome do colaborador" placeholderTextColor={t.textMuted}
              value={memberForm.name}
              onChangeText={v => setMemberForm(p => ({ ...p, name: v }))}
              autoCapitalize="words"
            />

            {/* Preview do username gerado automaticamente */}
            {memberForm.name.trim().length > 0 && (
              <View style={[mo.usernamePreview, { backgroundColor: t.brand + '22' }]}>
                <Text style={[mo.usernameLabel, { color: t.textMuted }]}>Usuário gerado automaticamente</Text>
                <Text style={[mo.usernameValue, { color: t.brand }]}>@{generateUsername(memberForm.name)}</Text>
              </View>
            )}

            <Text style={[mo.fieldLabel, { color: t.textSub }]}>Telefone (WhatsApp)</Text>
            <TextInput
              style={[mo.input, { backgroundColor: t.bg, color: t.text, borderColor: t.border }]}
              placeholder="(11) 99999-9999" placeholderTextColor={t.textMuted}
              value={memberForm.phone}
              onChangeText={v => setMemberForm(p => ({ ...p, phone: v }))}
              keyboardType="phone-pad"
            />

            <TouchableOpacity style={[mo.addBtn, { backgroundColor: t.brand }]} onPress={handleAddMember} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mo.addBtnText}>Criar e Vincular</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={mo.cancelBtn} onPress={() => setAddMemberModal(false)}>
              <Text style={[mo.cancelText, { color: t.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal Pendências de Acerto ── */}
      <Modal visible={debtModal} animationType="slide" transparent onRequestClose={() => setDebtModal(false)}>
        <View style={mo.overlay}>
          <View style={[mo.sheet, { backgroundColor: t.bgCard }]}>
            <View style={mo.header}>
              <Text style={[mo.title, { color: t.text }]}>Pendências de Acerto</Text>
              <TouchableOpacity onPress={() => setDebtModal(false)}>
                <Text style={{ fontSize: 20, color: t.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[mo.sub, { color: t.textMuted }]}>Membros com saldo em aberto</Text>
            {debtByMember.length === 0 ? (
              <Text style={[mo.empty, { color: t.textMuted }]}>Nenhuma pendência 🎉</Text>
            ) : debtByMember.map((m, i) => (
              <View key={m.username} style={[mo.debtRow, { borderBottomColor: t.separator, borderBottomWidth: i < debtByMember.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={[mo.avatar, { backgroundColor: '#dc2626' }]}>
                  <Text style={mo.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mo.memberName, { color: t.text }]}>{m.name}</Text>
                  <Text style={[mo.memberSub, { color: t.textMuted }]}>@{m.username}</Text>
                </View>
                <Text style={[mo.debtValue, { color: '#dc2626' }]}>{fmt(m.balance)}</Text>
              </View>
            ))}
            <View style={[mo.debtTotal, { borderTopColor: t.separator }]}>
              <Text style={[mo.debtTotalLabel, { color: t.textSub }]}>Total em aberto</Text>
              <Text style={[mo.debtTotalValue, { color: '#dc2626' }]}>{fmt(totalDebt)}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent:'center', alignItems:'center' },
  empty: { fontSize: 15 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 18, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width:0, height:2 }, elevation: 2 },
  cellName: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, marginTop: 2, color: 'rgba(255,255,255,0.8)' },
  btnRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionBtnFull: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 4, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tagBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 13, fontWeight: '700' },
  rowLabel: { fontSize: 14, flex: 1 },
});

const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 12, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: -8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  orderRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  orderName: { fontSize: 14, fontWeight: '600' },
  orderMeta: { fontSize: 11, marginTop: 2 },
  orderValue: { fontSize: 14, fontWeight: '700' },
  orderDogs: { fontSize: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  memberName: { fontSize: 14, fontWeight: '600' },
  memberSub: { fontSize: 12, marginTop: 2 },
  addBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 4 },
  usernamePreview: { borderRadius: 12, padding: 12, marginBottom: 4 },
  usernameLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  usernameValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  debtValue: { fontSize: 16, fontWeight: '800' },
  debtTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, marginTop: 4 },
  debtTotalLabel: { fontSize: 13, fontWeight: '700' },
  debtTotalValue: { fontSize: 18, fontWeight: '900' },
});
