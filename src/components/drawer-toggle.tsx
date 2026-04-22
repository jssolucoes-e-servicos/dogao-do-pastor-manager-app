import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { useTheme } from '@/lib/theme';

type Props = {
  title?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  right?: React.ReactNode;
};

export function DrawerHeader({ title, rightIcon, onRightPress, right }: Props) {
  const navigation = useNavigation();
  const { colors: t } = useTheme();

  return (
    <View style={[s.header, { backgroundColor: t.brand, paddingTop: Platform.OS === 'ios' ? 56 : 40 }]}>
      <TouchableOpacity
        onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
        style={s.iconBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="menu" size={26} color="#fff" />
      </TouchableOpacity>

      {title ? (
        <Text style={s.title} numberOfLines={1}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {right ? (
        <View style={s.iconBtn}>{right}</View>
      ) : rightIcon && onRightPress ? (
        <TouchableOpacity onPress={onRightPress} style={s.iconBtn}>
          <Ionicons name={rightIcon} size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={s.iconBtn} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 14, gap: 4,
  },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#fff' },
});
