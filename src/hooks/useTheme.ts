import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useTheme() {
  const theme = useSettingsStore((state) => state.persistedSettings.appearance.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    const setDarkClass = (enabled: boolean) => {
      root.classList.toggle('dark', enabled);
    };

    if (theme === 'dark') {
      setDarkClass(true);
    } else if (theme === 'light') {
      setDarkClass(false);
    } else {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateTheme = () => {
        setDarkClass(mediaQuery.matches);
      };

      updateTheme();
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }

    return undefined;
  }, [theme]);
}
