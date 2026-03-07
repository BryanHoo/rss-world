import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ArticleScrollAssistProps {
  visible: boolean;
  percent: number;
  onBackToTop: () => void;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function ArticleScrollAssist({
  visible,
  percent,
  onBackToTop,
}: ArticleScrollAssistProps) {
  const safePercent = clampPercent(percent);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safePercent / 100);

  if (!visible) {
    return null;
  }

  return (
    <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-sm">
        <svg viewBox="0 0 48 48" className="absolute h-12 w-12 -rotate-90">
          <circle cx="24" cy="24" r={radius} className="fill-none stroke-border/50" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="fill-none stroke-primary transition-all"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="relative text-xs font-medium text-foreground">{safePercent}%</span>
      </div>

      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label="回到顶部"
        className="h-14 w-14 rounded-full bg-background/80 shadow-sm backdrop-blur-sm"
        onClick={onBackToTop}
      >
        <ChevronUp className="size-5" />
      </Button>
    </div>
  );
}
