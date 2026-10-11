import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ghi chú nhỏ báo cho người dùng biết dữ liệu đang xem được crawl gần nhất
 * lúc nào — tránh hiểu nhầm số liệu là theo thời gian thực. */
export function DataFreshnessNote({
  lastCrawledAt,
  label = 'Dữ liệu cập nhật lần cuối lúc',
  className,
}: {
  lastCrawledAt: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!lastCrawledAt) return null;
  return (
    <p className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {label} {new Date(lastCrawledAt).toLocaleString('vi-VN')}
    </p>
  );
}
