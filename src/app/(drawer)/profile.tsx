import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { getProfile } from '@/lib/profile';
import { DrawerHeader } from '@/components/drawer-toggle';
import { alerts } from '@/lib/alerts';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors: t } = useTheme();
  const profile = user ? getProfile(user) : null;

  const initials = user?.name
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?';

  const roleLabel = profile?.isAdmin
    ? 'Administrador'
    : profile?.isFinance
    ? 'Financeiro'
    : profile?.isManager
    ? 'Recepção'
    : profile?.isSupervisor
    ? 'Supervisor de Rede'
    : profile?.isLeader
    ? 'Líder de Célula'
    : profile?.isSeller
    ? 'Vendedor'
    : 'Colaborador';

  function handleLogout() {
    alerts.confirm('Sair', 'Deseja encerrar a sessão?', logout);
  }

  const roleLabels: Record<string, string> = {
    'T.I': 'T.I', 'ADMINISTRAÇÃO': 'Administração', 'FINANCEIRO': 'Financeiro',
    'RECEPÇÃO': 'Recepção', 'VENDEDOR': 'Vendedor',
    'LÍDER DE CÉLULA': 'Líder de Célula', 'SUPERVISOR DE REDE': 'Supervisor de Rede',
  };

  const displayRoles = (user?.roles ?? [])
    .filter(r => !r.match(/^[a-z0-9]{20,}$/))
    .map(r => roleLabels[r] ?? r);

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Meu Perfil" />

      {/* Avatar section */}
      <View style={[s.avatarSection, { backgroundColor: '#ea580c' }]}>
        <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.4)' }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.username}>@{user?.username}</Text>
        <Text style={s.roleLabel}>{roleLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Role badges */}
        {displayRoles.length > 0 && (
          <View style={s.badges}>
            {displayRoles.map(r => (
              <View key={r} style={[s.badge, { backgroundColor: t.bgBrand, borderColor: t.border }]}>
                <Text style={[s.badgeText, { color: t.textBrand }]}>{r}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Seller info */}
        {(user?.sellers ?? []).length > 0 && (
          <>
            <Text style={[s.groupLabel, { color: t.textMuted }]}>VENDEDOR</Text>
            <View style={[s.card, { backgroundColor: t.bgCard }]}>
              {user!.sellers.map((sel, i, arr) => (
                <View
                  key={sel.id}
                  style={[s.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
                >
                  <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
                    <Ionicons name="pricetag-outline" size={18} color={t.textBrand} />
                  </View>
                  <Text style={[s.rowLabel, { color: t.text }]}>@{(sel as any).tag ?? sel.id}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Células */}
        {(user?.cells ?? []).length > 0 && (
          <>
            <Text style={[s.groupLabel, { color: t.textMuted }]}>CÉLULAS</Text>
            <View style={[s.card, { backgroundColor: t.bgCard }]}>
              {user!.cells.map((cell, i, arr) => (
                <View
                  key={cell.id}
                  style={[s.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
                >
                  <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
                    <Ionicons name="people-outline" size={18} color={t.textBrand} />
                  </View>
                  <Text style={[s.rowLabel, { color: t.text }]}>{cell.id}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Sessão */}
        <Text style={[s.groupLabel, { color: t.textMuted }]}>SESSÃO</Text>
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          <TouchableOpacity style={s.row} onPress={handleLogout} activeOpacity={0.6}>
            <View style={[s.iconWrap, { backgroundColor: '#fef2f2' }]}>
              <Ionicons name="log-out-outline" size={18} color={t.error} />
            </View>
            <Text style={[s.rowLabel, { color: t.error }]}>Sair da conta</Text>
            <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: { paddingTop: 24, paddingBottom: 28, alignItems: 'center', gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 4 },
  avatarText: { fontSize: 26, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  username: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  roleLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 48 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 8, marginLeft: 4 },
  card: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
});
