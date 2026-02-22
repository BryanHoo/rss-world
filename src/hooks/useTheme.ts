import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useTheme() {
  const { settings } = useSettingsStore();

  useEffect(() => {
    const root = window.document.documentElement;
    const setDarkClass = (enabled: boolean) => {
      root.classList.toggle('dark', enabled);
    };

    if (settings.theme === 'dark') {
      setDarkClass(true);
    } else if (settings.theme === 'light') {
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
  }, [settings.theme]);
}
