import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type ArticleImagePreviewProps = {
  image: { src: string; alt: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ArticleImagePreview({
  image,
  open,
  onOpenChange,
}: ArticleImagePreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="关闭图片预览"
        className="max-w-5xl p-3 sm:p-4"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">图片预览</DialogTitle>
        {image ? (
          <div className="flex max-h-[85vh] items-center justify-center overflow-hidden rounded-md">
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[80vh] w-auto max-w-full object-contain"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
