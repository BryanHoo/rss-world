import { useEffect, useState } from 'react';
import { ExternalLink, Languages, Sparkles, Star } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useSettingsStore } from '../../store/settingsStore';
import { enqueueArticleFulltext } from '../../lib/apiClient';
import { formatRelativeTime } from '../../utils/date';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function ArticleView() {
  const { articles, feeds, selectedArticleId, markAsRead, toggleStar, refreshArticle } =
    useAppStore();
  const general = useSettingsStore((state) => state.persistedSettings.general);
  const autoMarkReadEnabled = useSettingsStore(
    (state) => state.persistedSettings.general.autoMarkReadEnabled,
  );
  const autoMarkReadDelayMs = useSettingsStore(
    (state) => state.persistedSettings.general.autoMarkReadDelayMs,
  );
  const [fulltextLoading, setFulltextLoading] = useState(false);

  const article = articles.find((item) => item.id === selectedArticleId);
  const feed = article ? feeds.find((item) => item.id === article.feedId) : null;
  const feedFullTextOnOpenEnabled = feed?.fullTextOnOpenEnabled ?? false;

  useEffect(() => {
    if (!article || article.isRead) {
      return undefined;
    }

    if (!autoMarkReadEnabled) {
      return undefined;
    }

    if (autoMarkReadDelayMs === 0) {
      markAsRead(article.id);
      return undefined;
    }

    const timer = setTimeout(() => {
      markAsRead(article.id);
    }, autoMarkReadDelayMs);

    return () => clearTimeout(timer);
  }, [article, autoMarkReadDelayMs, autoMarkReadEnabled, markAsRead]);

  useEffect(() => {
    const articleId = article?.id ?? null;
    const articleLink = article?.link ?? '';
    if (!articleId) return;
    if (!feedFullTextOnOpenEnabled) return;
    if (!articleLink) return;

    let cancelled = false;

    void (async () => {
      try {
        const enqueueResult = await enqueueArticleFulltext(articleId);
        if (!enqueueResult.enqueued) return;
        if (cancelled) return;
        setFulltextLoading(true);
      } catch (err) {
        console.error(err);
        if (!cancelled) setFulltextLoading(false);
        return;
      }

      for (let attempt = 0; attempt < 15; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (cancelled) return;

        const refreshed = await refreshArticle(articleId);
        if (refreshed.hasFulltext) {
          if (!cancelled) setFulltextLoading(false);
          return;
        }
      }

      if (!cancelled) setFulltextLoading(false);
    })();

    return () => {
      cancelled = true;
      setFulltextLoading(false);
    };
  }, [article?.id, article?.link, feedFullTextOnOpenEnabled, refreshArticle]);

  if (!article) {
    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        <div className="h-12 shrink-0" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">选择一篇文章开始阅读</p>
        </div>
      </div>
    );
  }

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[general.fontSize];

  const lineHeightClass = {
    compact: 'leading-normal',
    normal: 'leading-relaxed',
    relaxed: 'leading-loose',
  }[general.lineHeight];

  const fontFamilyClass = general.fontFamily === 'serif' ? 'font-serif' : 'font-sans';

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="h-12 shrink-0" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 pb-12 pt-4">
          <div className="mb-8">
            <h1 className="mb-4 text-3xl font-bold tracking-tight">{article.title}</h1>

            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{feed?.icon}</span>
                <span>{feed?.title}</span>
                <span>·</span>
                <span>{formatRelativeTime(article.publishedAt)}</span>
                {article.author && (
                  <>
                    <span>·</span>
                    <span>{article.author}</span>
                  </>
                )}
              </div>
            </div>

            <TooltipProvider>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => toggleStar(article.id)}
                  variant={article.isStarred ? 'default' : 'secondary'}
                  className="h-8 px-3 text-sm"
                >
                  <Star fill={article.isStarred ? 'currentColor' : 'none'} />
                  <span>{article.isStarred ? '已收藏' : '收藏'}</span>
                </Button>

                <Button asChild variant="secondary" className="h-8 px-3 text-sm">
                  <a href={article.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    <span>原文</span>
                  </a>
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="secondary" className="h-8 px-3 text-sm">
                      <Languages />
                      <span>翻译</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>翻译功能即将上线</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="secondary" className="h-8 px-3 text-sm">
                      <Sparkles />
                      <span>AI摘要</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>AI摘要功能即将上线</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {fulltextLoading ? (
            <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/70"
                  aria-hidden="true"
                />
                <span>正在抓取全文，稍后会自动更新</span>
              </div>
            </div>
          ) : null}

          <div
            className={cn('prose max-w-none dark:prose-invert', fontSizeClass, lineHeightClass, fontFamilyClass)}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      </div>
    </div>
  );
}
