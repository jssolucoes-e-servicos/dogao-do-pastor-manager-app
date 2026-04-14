import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { palette, brand, type ThemeColors } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextType = {
  colors: ThemeColors & { brand: string; isDark: boolean; scheme: 'light' | 'dark' };
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync('theme_preference').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setPreferenceState(v);
    });
  }, []);

  async function setPreference(p: ThemePreference) {
    setPreferenceState(p);
    await SecureStore.setItemAsync('theme_preference', p);
  }

  const scheme: 'light' | 'dark' = preference === 'system' ? system : preference;
  const colors = { ...palette[scheme], brand, isDark: scheme === 'dark', scheme };

  return (
    <ThemeContext.Provider value={{ colors, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
