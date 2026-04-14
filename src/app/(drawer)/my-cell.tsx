import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/hooks/use-theme';
import { DrawerHeader } from '@/components/drawer-toggle';

type Seller = { id: string; tag: string; name?: string };
type Cell = {
  id: string;
  name: string;
  leader?: { name: string };
  network?: { name: string; supervisor?: { name: string } };
  sellers?: Seller[];
};

export default function MyCellScreen() {
  const { user } = useAuth();
  const { colors: t } = useTheme();
  const [cell, setCell] = useState<Cell | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  async function load() {
    setLoading(true);
    try {
      // 1. Líder direto (cells[])
      if ((user?.cells?.length ?? 0) > 0) {
        const data = await api.get<Cell>(`/cells/by-leader/${user!.id}`);
        setCell(data);
        return;
      }

      // 2. Vendedor — cellId já vem no objeto seller
      const cellId = user?.sellers?.[0]?.cellId ?? user?.cellsMember?.[0]?.cellId;
      if (cellId) {
        const data = await api.get<Cell>(`/cells/show/${cellId}`);
        setCell(data);
        return;
      }

      setDebugInfo(`cells:${user?.cells?.length ?? 0} sellers:${user?.sellers?.length ?? 0} cellId:${user?.sellers?.[0]?.cellId ?? 'none'}`);
      setCell(null);
    } catch (e: any) {
      setDebugInfo(e?.message ?? 'erro');
      setCell(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user?.id]);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Minha Célula" />

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={t.brand} size="large" />
        </View>
      ) : !cell ? (
        <View style={s.center}>
          <Text style={[s.empty, { color: t.textMuted }]}>Nenhuma célula encontrada.</Text>
          {!!debugInfo && (
            <Text style={[s.debug, { color: t.textMuted }]}>{debugInfo}</Text>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={t.brand} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
            <Text style={[s.cellName, { color: t.brand }]}>{cell.name}</Text>
            {cell.leader && (
              <Text style={[s.sub, { color: t.textSub }]}>Líder: {cell.leader.name}</Text>
            )}
            {cell.network && (
              <Text style={[s.sub, { color: t.textMuted }]}>Rede: {cell.network.name}</Text>
            )}
            <View style={s.statsRow}>
              <View style={[s.statBox, { backgroundColor: t.bgBrand }]}>
                <Text style={[s.statNum, { color: t.brand }]}>{cell.sellers?.length ?? 0}</Text>
                <Text style={[s.statLabel, { color: t.textSub }]}>Vendedores</Text>
              </View>
            </View>
          </View>

          {(cell.sellers ?? []).length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: t.textMuted }]}>VENDEDORES</Text>
              <View style={[s.card, { backgroundColor: t.bgCard, shadowColor: t.shadow }]}>
                {cell.sellers!.map((seller, i) => (
                  <View
                    key={seller.id}
                    style={[s.row, i < cell.sellers!.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
                  >
                    <View style={[s.tagBadge, { backgroundColor: t.bgBrand }]}>
                      <Text style={[s.tagText, { color: t.brand }]}>@{seller.tag}</Text>
                    </View>
                    {seller.name && (
                      <Text style={[s.rowLabel, { color: t.text }]}>{seller.name}</Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  empty: { fontSize: 15 },
  debug: { fontSize: 11, opacity: 0.5 },
  scroll: { padding: 16, gap: 8, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 18, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cellName: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  statBox: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  tagBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 13, fontWeight: '700' },
  rowLabel: { fontSize: 14, flex: 1 },
});
