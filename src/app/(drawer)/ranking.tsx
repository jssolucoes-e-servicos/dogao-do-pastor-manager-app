import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type SellerStats = { name: string; total: number };

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RankingScreen() {
  const t = useTheme().colors;
  const { user } = useAuth();
  const profile = user ? getProfile(user) : null;

  // Líderes e vendedores comuns só veem vendedores (da célula deles)
  // Supervisores, admins e financeiro veem células também
  const canSeeCells = profile?.isSupervisor || profile?.isAdmin || profile?.isFinance;

  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [cells, setCells] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'sellers' | 'cells'>('sellers');

  async function load() {
    setLoading(true);
    try {
      if (profile?.isLeader && !canSeeCells) {
        // Líder de célula: ranking da própria célula
        const res = await api.get<any>('/dashboard/my-summary');
        const ranking = res?.cell?.ranking ?? [];
        setSellers(ranking.length > 0 ? ranking : res?.rankingSellers ?? []);
        setCells([]);
      } else {
        // Todos os demais (vendedores, supervisores, admin): ranking global
        const res = await api.get<any>('/dashboard/summary');
        setSellers(res?.rankingSellers ?? []);
        setCells(res?.rankingCells ?? []);
      }
    } catch {
      setSellers([]);
      setCells([]);
    } finally {
      setLoading(false);
    }
  }

  // Carrega quando o perfil estiver disponível (não null)
  useEffect(() => {
    if (user) load();
  }, [profile?.isLeader, canSeeCells, user?.id]);

  const data = tab === 'sellers' ? sellers : cells;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Ranking" />

      {/* Tabs — aba Células só para quem pode ver */}
      {canSeeCells && (
        <View style={[s.tabs, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
          {(['sellers', 'cells'] as const).map(key => (
            <TouchableTab
              key={key}
              label={key === 'sellers' ? 'Vendedores' : 'Células'}
              active={tab === key}
              onPress={() => setTab(key)}
              t={t}
            />
          ))}
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={(item, i) => `${item.name}-${i}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          profile?.isLeader && !canSeeCells ? (
            <Text style={[s.cellLabel, { color: t.textMuted }]}>
              Vendedores da sua célula
            </Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={[s.empty, { color: t.textMuted }]}>Sem dados de ranking.</Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View style={[
            s.card,
            { backgroundColor: t.bgCard, shadowColor: t.shadow },
            index === 0 && { borderWidth: 2, borderColor: '#fbbf24', backgroundColor: t.warningBg },
          ]}>
            <Text style={s.medal}>{MEDALS[index] ?? `${index + 1}º`}</Text>
            <Text style={[s.name, { color: t.text, flex: 1 }]}>{item.name}</Text>
            <Text style={[s.dogs, { color: t.text }]}>{item.total} 🌭</Text>
          </View>
        )}
      />
    </View>
  );
}

function TouchableTab({ label, active, onPress, t }: {
  label: string; active: boolean; onPress: () => void; t: any;
}) {
  return (
    <TouchableOpacity
      style={[s.tab, active && { borderBottomColor: t.brand, borderBottomWidth: 2 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.tabLabel, { color: active ? t.brand : t.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  cellLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  list: { padding: 12, gap: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 16, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  medal: { fontSize: 24, width: 36, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  dogs: { fontSize: 16, fontWeight: '700' },
});
