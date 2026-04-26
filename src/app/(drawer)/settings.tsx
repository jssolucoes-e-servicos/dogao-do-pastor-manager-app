import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, Switch, TextInput, ActivityIndicator,
} from 'react-native';
import { alerts } from '@/lib/alerts';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import type { ThemePreference } from '@/lib/theme';
import { DrawerHeader } from '@/components/drawer-toggle';
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '@/lib/notifications';
import { api } from '@/lib/api';
import Constants from 'expo-constants';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Seguir o sistema', icon: 'phone-portrait-outline' },
  { value: 'light',  label: 'Claro',            icon: 'sunny-outline' },
  { value: 'dark',   label: 'Escuro',            icon: 'moon-outline' },
];

type NotifItem = { key: keyof NotificationPreferences; label: string; desc: string };
const NOTIF_ITEMS: NotifItem[] = [
  { key: 'sales',   label: 'Vendas',   desc: 'Nova venda, pagamento confirmado' },
  { key: 'orders',  label: 'Pedidos',  desc: 'Atualização de status de pedido'  },
  { key: 'ranking', label: 'Ranking',  desc: 'Ranking atualizado'               },
  { key: 'cell',    label: 'Célula',   desc: 'Atividade da sua célula'          },
  { key: 'network', label: 'Rede',     desc: 'Atividade da sua rede'            },
];

const ABOUT_ITEMS = [
  { label: 'Versão', icon: 'information-circle-outline' as const, getValue: () => Constants.expoConfig?.version ?? '—' },
  { label: 'Build',  icon: 'code-slash-outline' as const,         getValue: () => String(Constants.expoConfig?.android?.versionCode ?? '—') },
];

// Trocar senha — 3 steps: REQUEST → VERIFY → NEW_PASSWORD
type PwStep = 'REQUEST' | 'VERIFY' | 'NEW_PASSWORD';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { colors: t, preference, setPreference } = useTheme();
  const [themeModal, setThemeModal] = useState(false);
  const [systemModal, setSystemModal] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [pwStep, setPwStep] = useState<PwStep>('REQUEST');
  const [otp, setOtp] = useState('');
  const [validationToken, setValidationToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);

  const currentTheme = THEME_OPTIONS.find(o => o.value === preference)!;

  useEffect(() => {
    getNotificationPreferences().then(setPrefs).catch(() => {});
  }, []);


  async function togglePref(key: keyof NotificationPreferences, value: boolean) {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      await updateNotificationPreferences({ [key]: value });
    } catch {
      setPrefs(prev);
    }
  }

  function openPwModal() {
    setPwStep('REQUEST');
    setOtp(''); setValidationToken(''); setNewPw(''); setConfirmPw('');
    setPwModal(true);
  }

  async function handleRequestOtp() {
    setPwLoading(true);
    try {
      await api.post('/auth/request-otp', { userId: user!.id, type: 'CONTRIBUTOR' });
      setPwStep('VERIFY');
    } catch (e: any) {
      alerts.error(e?.message ?? 'Não foi possível enviar o código.');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) { alerts.alert('Digite o código'); return; }
    setPwLoading(true);
    try {
      const data = await api.post<any>('/auth/validate-otp', { userId: user!.id, code: otp });
      if (data?.otpValid && data?.token) {
        setValidationToken(data.token);
        setPwStep('NEW_PASSWORD');
      } else {
        alerts.alert('Código incorreto ou expirado.');
      }
    } catch (e: any) {
      alerts.error(e?.message ?? 'Erro na validação.');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSetPassword() {
    if (newPw !== confirmPw) { alerts.alert('As senhas não coincidem'); return; }
    if (newPw.length < 6) { alerts.alert('Mínimo 6 caracteres'); return; }
    setPwLoading(true);
    try {
      await api.patch('/auth/change-password', {
        userId: user!.id,
        type: 'CONTRIBUTOR',
        token: validationToken,
        password: newPw,
      });
      alerts.alert('Senha alterada com sucesso!');
      setPwModal(false);
    } catch (e: any) {
      alerts.error(e?.message ?? 'Não foi possível alterar a senha.');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <DrawerHeader title="Ajustes" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Aparência */}
        <Text style={[s.groupLabel, { color: t.textMuted }]}>APARÊNCIA</Text>
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          <TouchableOpacity style={s.row} onPress={() => setThemeModal(true)} activeOpacity={0.7}>
            <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
              <Ionicons name={currentTheme.icon} size={18} color={t.textBrand} />
            </View>
            <Text style={[s.rowLabel, { color: t.text }]}>Tema</Text>
            <Text style={[s.rowValue, { color: t.textSub }]}>{currentTheme.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Notificações */}
        <Text style={[s.groupLabel, { color: t.textMuted }]}>NOTIFICAÇÕES</Text>
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          <TouchableOpacity
            style={[s.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
            onPress={() => setSystemModal(true)}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={t.textBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: t.text }]}>Avisos do sistema</Text>
              <Text style={[s.rowSub, { color: t.textMuted }]}>Sempre ativo</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
          </TouchableOpacity>
          {NOTIF_ITEMS.map((item, i) => (
            <View
              key={item.key}
              style={[s.row, i < NOTIF_ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: t.text }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: t.textMuted }]}>{item.desc}</Text>
              </View>
              <Switch
                value={prefs?.[item.key] ?? true}
                onValueChange={(v) => togglePref(item.key, v)}
                thumbColor="#fff"
                trackColor={{ true: t.brand, false: t.border }}
              />
            </View>
          ))}
        </View>

        {/* Conta */}
        <Text style={[s.groupLabel, { color: t.textMuted }]}>CONTA</Text>
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          <View style={[s.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
            <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
              <Ionicons name="person-outline" size={18} color={t.textBrand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: t.text }]}>{user?.name}</Text>
              <Text style={[s.rowSub, { color: t.textSub }]}>@{user?.username}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.row}
            onPress={openPwModal}
            activeOpacity={0.6}
          >
            <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
              <Ionicons name="lock-closed-outline" size={18} color={t.textBrand} />
            </View>
            <Text style={[s.rowLabel, { color: t.text }]}>Trocar senha</Text>
            <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sobre */}
        <Text style={[s.groupLabel, { color: t.textMuted }]}>SOBRE</Text>
        <View style={[s.card, { backgroundColor: t.bgCard }]}>
          {ABOUT_ITEMS.map(({ label, icon, getValue }, i) => (
            <View
              key={label}
              style={[s.row, i < ABOUT_ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
            >
              <View style={[s.iconWrap, { backgroundColor: t.bgMuted }]}>
                <Ionicons name={icon} size={18} color={t.textBrand} />
              </View>
              <Text style={[s.rowLabel, { color: t.text }]}>{label}</Text>
              <Text style={[s.rowValue, { color: t.textSub }]}>{getValue()}</Text>
            </View>
          ))}
        </View>

        <Text style={[s.footer, { color: t.textMuted }]}>
          Desenvolvido por JS Soluções e Serviços
        </Text>
      </ScrollView>

      {/* Modal: Avisos do sistema */}
      <Modal visible={systemModal} transparent animationType="fade" onRequestClose={() => setSystemModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSystemModal(false)}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
            <View style={s.sheetIconRow}>
              <View style={[s.sheetIcon, { backgroundColor: t.bgBrand }]}>
                <Ionicons name="shield-checkmark" size={32} color={t.brand} />
              </View>
            </View>
            <Text style={[s.sheetTitle, { color: t.text }]}>Avisos do Sistema</Text>
            <Text style={[s.sheetDesc, { color: t.textSub }]}>
              Incluem alertas críticos, atualizações importantes e comunicados da liderança.{'\n\n'}
              Não podem ser desativados pois garantem que você receba informações essenciais.
            </Text>
            <TouchableOpacity style={[s.sheetBtn, { backgroundColor: t.brand }]} onPress={() => setSystemModal(false)}>
              <Text style={s.sheetBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Tema */}
      <Modal visible={themeModal} transparent animationType="fade" onRequestClose={() => setThemeModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setThemeModal(false)}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>
            <Text style={[s.sheetTitle, { color: t.text }]}>Tema</Text>
            {THEME_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  s.sheetRow,
                  i < THEME_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
                  preference === opt.value && { backgroundColor: t.bgBrand },
                ]}
                onPress={() => { setPreference(opt.value); setThemeModal(false); }}
                activeOpacity={0.7}
              >
                <Ionicons name={opt.icon} size={20} color={preference === opt.value ? t.brand : t.textSub} />
                <Text style={[s.sheetLabel, { color: preference === opt.value ? t.brand : t.text }]}>{opt.label}</Text>
                {preference === opt.value && <Ionicons name="checkmark" size={18} color={t.brand} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Trocar senha (3 steps) */}
      <Modal visible={pwModal} transparent animationType="slide" onRequestClose={() => setPwModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setPwModal(false)}>
          <View style={[s.sheet, { backgroundColor: t.bgCard }]}>

            {pwStep === 'REQUEST' && (
              <>
                <View style={s.sheetIconRow}>
                  <View style={[s.sheetIcon, { backgroundColor: t.bgBrand }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={28} color={t.brand} />
                  </View>
                </View>
                <Text style={[s.sheetTitle, { color: t.text }]}>Trocar Senha</Text>
                <Text style={[s.sheetDesc, { color: t.textSub }]}>
                  Vamos enviar um código de verificação para o seu WhatsApp cadastrado.
                </Text>
                <View style={s.pwForm}>
                  <TouchableOpacity
                    style={[s.sheetBtn, { backgroundColor: t.brand }]}
                    onPress={handleRequestOtp}
                    disabled={pwLoading}
                  >
                    {pwLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.sheetBtnText}>Receber código no WhatsApp</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {pwStep === 'VERIFY' && (
              <>
                <View style={s.sheetIconRow}>
                  <View style={[s.sheetIcon, { backgroundColor: t.bgBrand }]}>
                    <Ionicons name="key-outline" size={28} color={t.brand} />
                  </View>
                </View>
                <Text style={[s.sheetTitle, { color: t.text }]}>Código enviado!</Text>
                <Text style={[s.sheetDesc, { color: t.textSub }]}>
                  Digite o código de 6 dígitos que você recebeu no WhatsApp.
                </Text>
                <View style={s.pwForm}>
                  <TextInput
                    style={[s.input, { backgroundColor: t.bgMuted, color: t.text, borderColor: t.border }]}
                    placeholder="000000"
                    placeholderTextColor={t.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={setOtp}
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={[s.sheetBtn, { backgroundColor: t.brand }]}
                    onPress={handleVerifyOtp}
                    disabled={pwLoading}
                  >
                    {pwLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.sheetBtnText}>Validar código</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {pwStep === 'NEW_PASSWORD' && (
              <>
                <View style={s.sheetIconRow}>
                  <View style={[s.sheetIcon, { backgroundColor: t.bgBrand }]}>
                    <Ionicons name="lock-closed-outline" size={28} color={t.brand} />
                  </View>
                </View>
                <Text style={[s.sheetTitle, { color: t.text }]}>Nova Senha</Text>
                <View style={s.pwForm}>
                  <TextInput
                    style={[s.input, { backgroundColor: t.bgMuted, color: t.text, borderColor: t.border }]}
                    placeholder="Nova senha"
                    placeholderTextColor={t.textMuted}
                    secureTextEntry
                    value={newPw}
                    onChangeText={setNewPw}
                  />
                  <TextInput
                    style={[s.input, { backgroundColor: t.bgMuted, color: t.text, borderColor: t.border }]}
                    placeholder="Confirmar nova senha"
                    placeholderTextColor={t.textMuted}
                    secureTextEntry
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                  />
                  <TouchableOpacity
                    style={[s.sheetBtn, { backgroundColor: t.brand }]}
                    onPress={handleSetPassword}
                    disabled={pwLoading}
                  >
                    {pwLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={s.sheetBtnText}>Salvar nova senha</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  groupLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 24, marginLeft: 4 },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 1 },
  rowValue: { fontSize: 14 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36 },
  sheetIconRow: { alignItems: 'center', paddingTop: 24, paddingBottom: 4 },
  sheetIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
  sheetDesc: { fontSize: 14, lineHeight: 22, paddingHorizontal: 24, paddingBottom: 8, textAlign: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  sheetLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  sheetBtn: { marginHorizontal: 20, marginTop: 8, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  sheetBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  pwForm: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
});
