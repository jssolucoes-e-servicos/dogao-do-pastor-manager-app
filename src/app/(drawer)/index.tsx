import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { useDashboard } from '@/hooks/use-dashboard';
import { useTheme } from '@/lib/theme';
import { DrawerHeader } from '@/components/drawer-toggle';

function StatCard({ label, value, sub, accent, t }: {
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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: t } = useTheme();
  const { data, loading, refresh } = useDashboard();
  const profile = user ? getProfile(user) : null;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader
        title={`A Paz de Cristo, ${user?.name?.split(' ')[0]} 👋`}
      />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={t.brand} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.grid}>
          <StatCard label="Dogões vendidos" value={data?.totalDogsSold ?? '—'}
            sub={profile?.canSeeGlobalStats && data ? `${data.availableDogs} disponíveis` : undefined}
            accent t={t} />
          <StatCard label="Pendentes" value={data?.pendingDogs ?? '—'} sub="aguardando pagamento" t={t} />
          {profile?.canSeeRevenue && (
            <StatCard label="Receita" value={data ? formatCurrency(data.totalRevenue) : '—'} t={t} />
          )}
          {profile?.canSeeGlobalStats && (
            <StatCard label="Doações" value={data?.totalDonations ?? '—'} sub="dogões doados" t={t} />
          )}
        </View>

        {profile?.canSeeRanking && data?.rankingSellers && data.rankingSellers.length > 0 && (
          <View style={[s.section, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: t.text }]}>🏆 Top Vendedores</Text>
              <TouchableOpacity onPress={() => router.push('/(drawer)/ranking')}>
                <Text style={[s.sectionLink, { color: t.textBrand }]}>Ver todos</Text>
              </TouchableOpacity>
            </View>
            {data.rankingSellers.slice(0, 5).map((seller, i) => (
              <View
                key={seller.name}
                style={[s.rankRow, { borderBottomColor: t.separator }, i === Math.min(data.rankingSellers.length, 5) - 1 && { borderBottomWidth: 0 }]}
              >
                <Text style={[s.rankPos, { color: t.textBrand }]}>{i + 1}º</Text>
                <Text style={[s.rankName, { color: t.text }]}>{seller.name}</Text>
                <Text style={[s.rankValue, { color: t.text }]}>{seller.total} 🌭</Text>
              </View>
            ))}
          </View>
        )}

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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flex: 1, minWidth: '45%', borderRadius: 18, padding: 18, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  cardValue: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  cardLabel: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  cardSub: { fontSize: 11, marginTop: 3 },
  section: { borderRadius: 18, padding: 18, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionLink: { fontSize: 13, fontWeight: '600' },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rankPos: { width: 28, fontSize: 13, fontWeight: '800' },
  rankName: { flex: 1, fontSize: 14 },
  rankValue: { fontSize: 14, fontWeight: '700' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, paddingVertical: 18, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
