import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useSettingsStore } from '../store/settingsStore';

export function useKeyboardShortcuts() {
  const articles = useAppStore((state) => state.articles);
  const selectedArticleId = useAppStore((state) => state.selectedArticleId);
  const setSelectedArticle = useAppStore((state) => state.setSelectedArticle);
  const toggleStar = useAppStore((state) => state.toggleStar);
  const markAsRead = useAppStore((state) => state.markAsRead);
  const shortcuts = useSettingsStore((state) => state.persistedSettings.shortcuts);

  useEffect(() => {
    if (!shortcuts.enabled) {
      return undefined;
    }

    const keyMap: Record<string, 'nextArticle' | 'prevArticle' | 'toggleStar' | 'markRead' | 'openOriginal'> = {
      [shortcuts.bindings.nextArticle.toLowerCase()]: 'nextArticle',
      [shortcuts.bindings.prevArticle.toLowerCase()]: 'prevArticle',
      [shortcuts.bindings.toggleStar.toLowerCase()]: 'toggleStar',
      [shortcuts.bindings.markRead.toLowerCase()]: 'markRead',
      [shortcuts.bindings.openOriginal.toLowerCase()]: 'openOriginal',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const action = keyMap[e.key.toLowerCase()];
      if (!action) {
        return;
      }

      const currentIndex = articles.findIndex((article) => article.id === selectedArticleId);

      switch (action) {
        case 'nextArticle':
          e.preventDefault();
          if (currentIndex < articles.length - 1) {
            setSelectedArticle(articles[currentIndex + 1].id);
          }
          break;
        case 'prevArticle':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedArticle(articles[currentIndex - 1].id);
          }
          break;
        case 'toggleStar':
          e.preventDefault();
          if (selectedArticleId) {
            toggleStar(selectedArticleId);
          }
          break;
        case 'markRead':
          e.preventDefault();
          if (selectedArticleId) {
            markAsRead(selectedArticleId);
          }
          break;
        case 'openOriginal':
          e.preventDefault();
          if (selectedArticleId) {
            const article = articles.find((item) => item.id === selectedArticleId);
            if (article) {
              window.open(article.link, '_blank');
            }
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [articles, selectedArticleId, setSelectedArticle, toggleStar, markAsRead, shortcuts]);
}
