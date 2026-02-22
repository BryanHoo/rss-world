import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function useKeyboardShortcuts() {
  const articles = useAppStore((state) => state.articles);
  const selectedArticleId = useAppStore((state) => state.selectedArticleId);
  const setSelectedArticle = useAppStore((state) => state.setSelectedArticle);
  const toggleStar = useAppStore((state) => state.toggleStar);
  const markAsRead = useAppStore((state) => state.markAsRead);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentIndex = articles.findIndex((article) => article.id === selectedArticleId);

      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          if (currentIndex < articles.length - 1) {
            setSelectedArticle(articles[currentIndex + 1].id);
          }
          break;
        case 'k':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedArticle(articles[currentIndex - 1].id);
          }
          break;
        case 's':
          e.preventDefault();
          if (selectedArticleId) {
            toggleStar(selectedArticleId);
          }
          break;
        case 'm':
          e.preventDefault();
          if (selectedArticleId) {
            markAsRead(selectedArticleId);
          }
          break;
        case 'v':
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
  }, [articles, selectedArticleId, setSelectedArticle, toggleStar, markAsRead]);
}
