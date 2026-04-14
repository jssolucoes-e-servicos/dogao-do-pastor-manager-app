import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Seller = { id: string; tag: string; name?: string };
type Cell = { id: string; name: string; leader?: { name: string }; sellers?: Seller[] };
type Network = {
  id: string;
  name: string;
  supervisor?: { name: string };
  cells?: Cell[];
};

export default function MyNetworkScreen() {
  const { user } = useAuth();
  const { colors: t } = useTheme();
  const [network, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const supervisorId = user?.id;
      if (!supervisorId) return;
      const data = await api.get<Network>(`/cells-networks/by-supervisor/${supervisorId}`);
      setNetwork(data);
    } catch {
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user?.id]);

  const totalSellers = (network?.cells ?? []).reduce((acc, c) => acc + (c.sellers?.length ?? 0), 0);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Minha Rede" />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={t.brand} size="large" />
        </View>
      ) : !network ? (
        <View style={s.center}>
          <Text style={[s.empty, { color: t.textMuted }]}>Nenhuma rede encontrada.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Info card */}
          <View style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
            <Text style={[s.networkName, { color: t.brand }]}>{network.name}</Text>
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: t.bgBrand }]}>
                <Text style={[s.statNum, { color: t.brand }]}>{network.cells?.length ?? 0}</Text>
                <Text style={[s.statLabel, { color: t.textSub }]}>Células</Text>
              </View>
              <View style={[s.statBox, { backgroundColor: t.bgBrand }]}>
                <Text style={[s.statNum, { color: t.brand }]}>{totalSellers}</Text>
                <Text style={[s.statLabel, { color: t.textSub }]}>Vendedores</Text>
              </View>
            </View>
          </View>

          {/* Células */}
          {(network.cells ?? []).length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: t.textMuted }]}>CÉLULAS</Text>
              {network.cells!.map(cell => (
                <View key={cell.id} style={[s.cellCard, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
                  <View style={s.cellHeader}>
                    <Text style={[s.cellName, { color: t.text }]}>{cell.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.cellCount, { color: t.textMuted }]}>
                        {cell.sellers?.length ?? 0} vendedor{(cell.sellers?.length ?? 0) !== 1 ? 'es' : ''}
                      </Text>
                    </View>
                  </View>
                  {cell.leader && (
                    <Text style={[s.leaderName, { color: t.textSub }]}>Líder: {cell.leader.name}</Text>
                  )}
                  {(cell.sellers ?? []).length > 0 && (
                    <View style={s.tags}>
                      {cell.sellers!.map(sel => (
                        <View key={sel.id} style={[s.tagBadge, { backgroundColor: t.bgBrand }]}>
                          <Text style={[s.tagText, { color: t.brand }]}>@{sel.tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontSize: 15 },
  scroll: { padding: 16, gap: 8, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 18, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  networkName: { fontSize: 22, fontWeight: '800', marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8, marginLeft: 4 },
  cellCard: { borderRadius: 14, padding: 14, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, gap: 6 },
  cellHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cellName: { fontSize: 15, fontWeight: '700' },
  cellCount: { fontSize: 12 },
  leaderName: { fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12, fontWeight: '700' },
});
