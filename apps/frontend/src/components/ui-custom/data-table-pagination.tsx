import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataTablePaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function DataTablePagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(total / limit) || 1;
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border/70 mt-3 rounded-b-xl">
      {/* Items range & total count */}
      <div className="text-xs sm:text-sm text-muted-foreground">
        Hiển thị <span className="font-semibold text-foreground">{startItem}</span> -{' '}
        <span className="font-semibold text-foreground">{endItem}</span> trên tổng số{' '}
        <span className="font-semibold text-foreground">{total}</span> bản ghi
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        {/* Page size select */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">
            Số mục/trang:
          </span>
          <Select
            value={String(limit)}
            onValueChange={(val) => {
              onLimitChange(Number(val));
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Current page indicator */}
        <div className="text-xs sm:text-sm font-medium text-foreground">
          Trang {page} / {totalPages}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            title="Trang đầu"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            title="Trang trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            title="Trang sau"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            title="Trang cuối"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
