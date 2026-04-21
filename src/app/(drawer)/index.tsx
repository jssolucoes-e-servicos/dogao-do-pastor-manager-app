import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { useMyDashboard } from '@/hooks/use-dashboard';
import { useTheme } from '@/lib/theme';
import { DrawerHeader } from '@/components/drawer-toggle';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Card pequeno (metade da largura) ─────────────────────────────────────────
function SmallCard({
  label, value, sub, accent, t,
}: {
  label: string; value: string | number; sub?: string; accent?: boolean;
  t: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[
      s.card,
      { backgroundColor: accent ? t.brand : t.bgCard, shadowColor: t.shadow },
    ]}>
      <Text style={[s.cardValue, { color: accent ? '#fff' : t.text }]}>{value}</Text>
      <Text style={[s.cardLabel, { color: accent ? 'rgba(255,255,255,0.75)' : t.textSub }]}>{label}</Text>
      {sub ? <Text style={[s.cardSub, { color: accent ? 'rgba(255,255,255,0.55)' : t.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

// ── Card de meta (largura total) ──────────────────────────────────────────────
function GoalCard({
  editionName, sold, goal, percent, t,
}: {
  editionName: string; sold: number; goal: number; percent: number;
  t: ReturnType<typeof useTheme>['colors'];
}) {
  const barColor = percent >= 100 ? '#16a34a' : percent >= 70 ? '#ea580c' : t.brand;
  return (
    <View style={[s.goalCard, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
      <View style={s.goalHeader}>
        <View>
          <Text style={[s.goalEdition, { color: t.textMuted }]}>{editionName}</Text>
          <Text style={[s.goalTitle, { color: t.text }]}>Meta da Edição</Text>
        </View>
        <Text style={[s.goalPercent, { color: barColor }]}>{percent}%</Text>
      </View>
      <View style={[s.barBg, { backgroundColor: t.separator }]}>
        <View style={[s.barFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }]} />
      </View>
      <View style={s.goalFooter}>
        <Text style={[s.goalNum, { color: t.text }]}>
          <Text style={{ color: barColor, fontWeight: '800' }}>{sold}</Text> / {goal} dogões
        </Text>
        <Text style={[s.goalSub, { color: t.textMuted }]}>{goal - sold > 0 ? `Faltam ${goal - sold}` : '🎉 Meta atingida!'}</Text>
      </View>
    </View>
  );
}

// ── Seção de ranking ──────────────────────────────────────────────────────────
function RankingSection({
  title, items, onSeeAll, t,
}: {
  title: string; items: { name: string; total: number }[];
  onSeeAll?: () => void; t: ReturnType<typeof useTheme>['colors'];
}) {
  if (items.length === 0) return null;
  return (
    <View style={[s.section, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: t.text }]}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={[s.sectionLink, { color: t.textBrand }]}>Ver todos</Text>
          </TouchableOpacity>
        )}
      </View>
      {items.slice(0, 5).map((item, i) => (
        <View
          key={item.name}
          style={[
            s.rankRow,
            { borderBottomColor: t.separator },
            i === Math.min(items.length, 5) - 1 && { borderBottomWidth: 0 },
          ]}
        >
          <Text style={[s.rankPos, { color: t.textBrand }]}>{i + 1}º</Text>
          <Text style={[s.rankName, { color: t.text }]}>{item.name}</Text>
          <Text style={[s.rankValue, { color: t.text }]}>{item.total} 🌭</Text>
        </View>
      ))}
    </View>
  );
}

// ── Tela principal ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: t } = useTheme();
  const { data, loading, refresh } = useMyDashboard();
  const profile = user ? getProfile(user) : null;

  const global = data?.global;
  const cell = data?.cell;
  const seller = data?.seller;

  // Fallback: se o endpoint my-summary falhou, mostra pelo menos o botão de nova venda
  const hasAnyData = global || cell || seller;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title={`A Paz de Cristo, ${user?.name?.split(' ')[0]} 👋`} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Card de meta global (sempre visível quando há dados) ── */}
        {global ? (
          <GoalCard
            editionName={global.editionName}
            sold={global.dogsSold}
            goal={global.dogsGoal}
            percent={global.percentReached}
            t={t}
          />
        ) : !loading && (
          <View style={[s.goalCard, { backgroundColor: t.bgCard, shadowColor: t.shadow, alignItems: 'center', justifyContent: 'center', minHeight: 80 }]}>
            <Text style={[s.goalEdition, { color: t.textMuted }]}>Sem edição ativa</Text>
          </View>
        )}

        {/* ── Métricas da célula (quando há dados de célula) ── */}
        {cell && (
          <>
            <Text style={[s.sectionLabel, { color: t.textMuted }]}>Métricas da Célula — {cell.cellName}</Text>
            <View style={s.grid}>
              <SmallCard label="Dogs Vendidos" value={cell.dogsSold} accent t={t} />
              <SmallCard label="Pendentes" value={cell.dogsPending} sub="aguardando pagamento" t={t} />
            </View>
          </>
        )}

        {/* ── Métricas do vendedor (quando não há dados de célula) ── */}
        {!cell && seller && (
          <>
            <Text style={[s.sectionLabel, { color: t.textMuted }]}>Minhas Vendas</Text>
            <View style={s.grid}>
              <SmallCard label="Dogs Vendidos" value={seller.dogsSold} accent t={t} />
              <SmallCard label="Pendentes" value={seller.dogsPending} sub="aguardando pagamento" t={t} />
            </View>
          </>
        )}

        {/* ── Ranking da célula ── */}
        {cell && cell.ranking.length > 0 && (
          <RankingSection
            title={`🏆 Ranking — ${cell.cellName}`}
            items={cell.ranking}
            t={t}
          />
        )}

        {/* ── Botão nova venda ── */}
        <TouchableOpacity
          style={[s.cta, { backgroundColor: t.brand, shadowColor: t.brand }]}
          activeOpacity={0.85}
          onPress={() => router.push('/new-sale')}
        >
          <Ionicons name="add-circle-outline" size={22} color="#fff" />
          <Text style={s.ctaText}>Nova Venda</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  // Meta card
  goalCard: {
    borderRadius: 18, padding: 18, gap: 12,
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalEdition: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalTitle: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  goalPercent: { fontSize: 28, fontWeight: '900' },
  barBg: { height: 8, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 99 },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalNum: { fontSize: 14, fontWeight: '600' },
  goalSub: { fontSize: 12 },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -4,
  },

  // Grid de cards pequenos
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flex: 1, minWidth: '45%', borderRadius: 18, padding: 18,
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  cardLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  cardSub: { fontSize: 11, marginTop: 3 },

  // Seção de ranking
  section: {
    borderRadius: 18, padding: 18,
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionLink: { fontSize: 13, fontWeight: '600' },
  rankRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankPos: { width: 28, fontSize: 13, fontWeight: '800' },
  rankName: { flex: 1, fontSize: 14 },
  rankValue: { fontSize: 14, fontWeight: '700' },

  // CTA
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 18,
    shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
