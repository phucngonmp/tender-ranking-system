import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, X, RefreshCw } from 'lucide-react';
import { CrawlJobToast } from '../../hooks/useCrawlJobToasts';
import { cn } from '@/lib/utils';

export function CrawlJobToaster({
  toasts,
  dismiss,
}: {
  toasts: CrawlJobToast[];
  dismiss: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  function handleRefresh(toast: CrawlJobToast) {
    queryClient.invalidateQueries({ queryKey: ['tenders'] });
    queryClient.invalidateQueries({ queryKey: ['sources'] });
    queryClient.invalidateQueries({ queryKey: ['crawl-jobs'] });
    dismiss(toast.id);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => handleRefresh(toast)}
          className={cn(
            'group flex items-start gap-2.5 rounded-lg border bg-popover p-3 text-left shadow-lg ring-1 ring-foreground/10 transition-colors hover:bg-accent animate-in slide-in-from-bottom-2 fade-in',
            toast.status === 'failed' ? 'border-destructive/40' : 'border-emerald-400/40'
          )}
        >
          {toast.status === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {toast.status === 'success' ? 'Đồng bộ dữ liệu xong' : 'Đồng bộ dữ liệu thất bại'}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {toast.sourceName}
              {toast.status === 'success' && ` — ${toast.itemsFound} gói thầu`}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              <RefreshCw className="h-3 w-3" />
              Nhấn để làm mới
            </p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              dismiss(toast.id);
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>
      ))}
    </div>
  );
}
