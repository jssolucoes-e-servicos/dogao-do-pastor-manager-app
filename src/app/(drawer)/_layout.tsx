import { Drawer } from 'expo-router/drawer';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

type MenuItem = {
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function DrawerContent(props: any) {
  const { user } = useAuth();
  const router = useRouter();
  const { colors: t } = useTheme();
  const profile = user ? getProfile(user) : null;

  const initials = user?.name
    ?.split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
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

  function go(route: string) {
    props.navigation.closeDrawer();
    router.push(route as any);
  }

  const hasSeller = (user?.sellers?.length ?? 0) > 0 || (user?.cellsMember?.length ?? 0) > 0;

  // ── Menu principal ──────────────────────────────────────
  const mainItems: MenuItem[] = [
    { route: '/(drawer)/', label: 'Início', icon: 'home-outline' },
  ];

  if (hasSeller || profile?.isAdmin || profile?.isManager) {
    mainItems.push({ route: '/(drawer)/sales', label: 'Minhas Vendas', icon: 'receipt-outline' });
  }

  if (profile?.canSeeGlobalStats) {
    mainItems.push({ route: '/(drawer)/orders', label: 'Pedidos', icon: 'list-outline' });
  }

  if (profile?.canSeeCellStats) {
    mainItems.push({ route: '/(drawer)/donations', label: 'Doações', icon: 'heart-outline' });
  }

  if (profile?.canSeeRanking) {
    mainItems.push({ route: '/(drawer)/ranking', label: 'Ranking', icon: 'trophy-outline' });
  }

  // Minha Célula — líderes, vendedores ou membros de célula
  const hasCellAccess = profile?.isLeader || profile?.isSeller
    || (user?.cellsMember?.length ?? 0) > 0;
  if (hasCellAccess) {
    mainItems.push({ route: '/(drawer)/my-cell', label: 'Minha Célula', icon: 'people-outline' });
  }

  // Minha Rede — supervisores e acima
  if (profile?.isSupervisor || profile?.isAdmin) {
    mainItems.push({ route: '/(drawer)/my-network', label: 'Minha Rede', icon: 'git-network-outline' });
  }

  const currentRoute = props.state?.routes?.[props.state.index]?.name ?? '';

  return (
    <View style={[s.root, { backgroundColor: t.drawerBg }]}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User header */}
        <View style={s.userSection}>
          <View style={[s.avatar, { backgroundColor: t.brand }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.userName, { color: t.text }]} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={[s.userRole, { color: t.textMuted }]}>{roleLabel}</Text>
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: t.border }]} />

        {/* Nav items */}
        <View style={s.nav}>
          {mainItems.map(item => {
            const slug = item.route.split('/').pop() ?? '';
            const isActive = slug === '' ? currentRoute === 'index' : currentRoute === slug;
            return (
              <TouchableOpacity
                key={item.route}
                style={[s.navItem, isActive && { backgroundColor: t.brand }]}
                onPress={() => go(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={20} color={isActive ? '#fff' : t.textSub} />
                <Text style={[s.navLabel, { color: isActive ? '#fff' : t.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </DrawerContentScrollView>

      {/* Footer fixo */}
      <View style={[s.footer, { borderTopColor: t.border }]}>
        <TouchableOpacity style={s.footerItem} onPress={() => go('/(drawer)/profile')} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={20} color={t.textSub} />
          <Text style={[s.footerLabel, { color: t.text }]}>Meu Perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.footerItem} onPress={() => go('/(drawer)/settings')} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={20} color={t.textSub} />
          <Text style={[s.footerLabel, { color: t.text }]}>Ajustes</Text>
        </TouchableOpacity>

        <Text style={[s.version, { color: t.textMuted }]}>
          v{Constants.expoConfig?.version} · Dogão do Pastor
        </Text>
      </View>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerShown: false, drawerStyle: { width: 300 } }}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingTop: 56, paddingHorizontal: 16 },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  userName: { fontSize: 15, fontWeight: '700' },
  userRole: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 12 },
  nav: { gap: 4 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
  },
  navLabel: { fontSize: 15, fontWeight: '500' },
  footer: {
    paddingHorizontal: 16, paddingBottom: 36, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  footerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14,
  },
  footerLabel: { fontSize: 15, fontWeight: '500' },
  version: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
