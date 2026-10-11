import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { DataFreshness, PaginatedResult, RubricBreakdown, Source, TenderListItem } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { formatCurrency, formatDate, formatDateTimeShort, getTenderStatus, getSingaporeEstimatedPriceInfo, TENDER_STATUS_LABELS } from '../utils/format';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { DataFreshnessNote } from '@/components/ui-custom/data-freshness-note';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField =
  | 'title'
  | 'investor'
  | 'locality'
  | 'estimated_value'
  | 'submission_open_date'
  | 'published_at'
  | 'source_keyword'
  | 'final_score'
  | 'rubric_score';

const TEXT_SORT_FIELDS: SortField[] = ['title', 'investor', 'locality', 'source_keyword'];

const SCORE_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'pending'> = {
  high: 'success',
  medium: 'warning',
  low: 'destructive',
};

const RUBRIC_MAX = 120;

export function TendersPage() {
  const { params, setParams } = useUrlParams({
    page: 1,
    limit: 10,
    min_score: '',
    sector: '',
    locality: '',
    source_id: '',
    keyword: '',
    status: 'open',
    sort: 'final_score' as SortField,
    order: 'desc' as 'asc' | 'desc',
  });

  function handleSort(field: SortField) {
    if (params.sort === field) {
      setParams({ order: params.order === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      setParams({ sort: field, order: TEXT_SORT_FIELDS.includes(field) ? 'asc' : 'desc', page: 1 });
    }
  }

  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => (await apiClient.get<Source[]>('/sources')).data,
  });

  const { data: freshness } = useQuery({
    queryKey: ['tenders-data-freshness'],
    queryFn: async () => (await apiClient.get<DataFreshness>('/tenders/data-freshness')).data,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenders', params],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResult<TenderListItem>>('/tenders', {
        params: {
          sort: params.sort,
          order: params.order,
          min_score: params.min_score || undefined,
          sector: params.sector || undefined,
          locality: params.locality || undefined,
          source_id: params.source_id || undefined,
          keyword: params.keyword || undefined,
          status: params.status === 'all' ? undefined : params.status,
          page: params.page,
          limit: params.limit,
        },
      });
      return response.data;
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Danh sách gói thầu</h1>
        <DataFreshnessNote lastCrawledAt={freshness?.lastCrawledAt} label="Dữ liệu gói thầu cập nhật lần cuối lúc" className="mt-1.5" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-xs font-medium text-muted-foreground">Điểm tối thiểu</label>
          <Input
            type="number"
            min={0}
            max={100}
            className="h-9 text-sm"
            value={params.min_score}
            onChange={(e) => setParams({ min_score: e.target.value, page: 1 })}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Lĩnh vực</label>
          <Input
            type="text"
            className="h-9 text-sm"
            value={params.sector}
            onChange={(e) => setParams({ sector: e.target.value, page: 1 })}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Địa phương</label>
          <Input
            type="text"
            placeholder="Ví dụ: Hà Nội"
            className="h-9 text-sm"
            value={params.locality}
            onChange={(e) => setParams({ locality: e.target.value, page: 1 })}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Từ khoá tìm kiếm</label>
          <Input
            type="text"
            placeholder="Tìm theo tên, mã gói thầu, bên mời thầu..."
            className="h-9 text-sm"
            value={params.keyword}
            onChange={(e) => setParams({ keyword: e.target.value, page: 1 })}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs font-medium text-muted-foreground">Nguồn dữ liệu</label>
          <Select
            value={params.source_id || 'all'}
            onValueChange={(val) => setParams({ source_id: val === 'all' ? '' : val, page: 1 })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {sources?.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Trạng thái</label>
          <Select
            value={params.status || 'all'}
            onValueChange={(val) => setParams({ status: val, page: 1 })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="open">Đang mở thầu</SelectItem>
              <SelectItem value="closed">Đã đóng thầu</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Đang tải...
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Không thể tải danh sách gói thầu.
        </div>
      )}

      {data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead className="min-w-[200px]" field="title" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Tên gói thầu
                </SortableHead>
                <SortableHead className="min-w-[160px]" field="investor" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Chủ đầu tư
                </SortableHead>
                <SortableHead className="min-w-[140px]" field="locality" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Địa phương
                </SortableHead>
                <SortableHead className="whitespace-nowrap" field="estimated_value" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Giá trị
                </SortableHead>
                <SortableHead className="whitespace-nowrap" field="submission_open_date" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Ngày mở thầu
                </SortableHead>
                <SortableHead className="whitespace-nowrap" field="published_at" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Ngày đăng tải
                </SortableHead>
                <TableHead>Trạng thái</TableHead>
                <SortableHead className="min-w-[140px]" field="source_keyword" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Từ khoá tìm kiếm
                </SortableHead>
                <SortableHead className="whitespace-nowrap text-right" field="final_score" currentSort={params.sort} order={params.order} onSort={handleSort} align="right">
                  Điểm phù hợp
                </SortableHead>
                <SortableHead className="whitespace-nowrap text-right" field="rubric_score" currentSort={params.sort} order={params.order} onSort={handleSort} align="right">
                  Điểm tiêu chí
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((tender) => (
                <TableRow key={tender.id}>
                  <TableCell className="max-w-[280px] whitespace-normal break-words">
                    <Link
                      to={`/tenders/${tender.id}`}
                      className="font-medium text-primary hover:underline underline-offset-2"
                    >
                      {tender.title}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal break-words text-muted-foreground">
                    {tender.investor ?? '-'}
                  </TableCell>
                  <TableCell className="max-w-[180px] whitespace-normal break-words text-muted-foreground">
                    {tender.locality ?? '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {(() => {
                      const sgInfo = getSingaporeEstimatedPriceInfo(
                        tender.estimated_value,
                        tender.currency,
                        tender.title,
                        tender.external_code
                      );
                      if (sgInfo) {
                        return (
                          <div className="flex flex-col" title={sgInfo.ceilingText}>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">
                                {sgInfo.displayRange}
                              </span>
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                Ước lượng
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {sgInfo.ceilingText}
                            </span>
                          </div>
                        );
                      }
                      return tender.currency === 'SGD' && tender.estimated_value ? (
                        <div className="flex items-center gap-1.5" title="Giá trị ước lượng theo hạn mức GRA / quy chế GeBIZ Singapore">
                          <span className="font-bold text-foreground">
                            {formatCurrency(tender.estimated_value, 'SGD')}
                          </span>
                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            Ước lượng
                          </span>
                        </div>
                      ) : (
                        formatCurrency(tender.estimated_value, tender.currency ?? 'VND')
                      );
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTimeShort(tender.submission_open_date)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(tender.published_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StatusBadge deadline={tender.submission_deadline} />
                  </TableCell>
                  <TableCell className="max-w-[180px] whitespace-normal break-words text-muted-foreground">
                    {tender.source_keyword ?? '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <ScoreBadge score={tender.final_score} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <RubricScoreBadge score={tender.rubric_score} breakdown={tender.rubric_breakdown} />
                  </TableCell>
                </TableRow>
              ))}
              {data.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    Không có gói thầu nào phù hợp bộ lọc.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* DataTablePagination */}
          <DataTablePagination
            page={params.page}
            limit={params.limit}
            total={data.pagination.total}
            onPageChange={(p) => setParams({ page: p })}
            onLimitChange={(l) => setParams({ limit: l, page: 1 })}
          />
        </>
      )}
    </div>
  );
}

function SortableHead({
  field,
  currentSort,
  order,
  onSort,
  children,
  className,
  align,
}: {
  field: SortField;
  currentSort: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  children: ReactNode;
  className?: string;
  align?: 'right';
}) {
  const isActive = currentSort === field;
  const Icon = isActive ? (order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          align === 'right' && 'flex-row-reverse',
          isActive && 'text-foreground font-medium'
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5', !isActive && 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <Badge variant="pending">Chưa chấm</Badge>;
  }
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return <Badge variant={SCORE_VARIANT[level]}>{score}</Badge>;
}

function RubricScoreBadge({
  score,
  breakdown,
}: {
  score: number | null;
  breakdown: RubricBreakdown | null;
}) {
  if (score === null) {
    return <Badge variant="pending">Chưa chấm</Badge>;
  }
  const level = score >= RUBRIC_MAX * 0.7 ? 'high' : score >= RUBRIC_MAX * 0.4 ? 'medium' : 'low';
  const badge = (
    <Badge variant={SCORE_VARIANT[level]}>
      {score}/{RUBRIC_MAX}
    </Badge>
  );
  if (!breakdown) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        <div className="space-y-1 text-left">
          {breakdown.groups.map((g) => (
            <p key={g.groupId}>
              {g.groupName}: {g.points}đ — {g.label}
              {g.reasons && g.reasons.length > 0 ? ` (${g.reasons.join(', ')})` : ''}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ deadline }: { deadline: string | null }) {
  const status = getTenderStatus(deadline);
  const variantMap: Record<string, 'success' | 'destructive' | 'pending'> = {
    open: 'success',
    closed: 'destructive',
    unknown: 'pending',
  };
  return <Badge variant={variantMap[status] ?? 'pending'}>{TENDER_STATUS_LABELS[status]}</Badge>;
}
