import { ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import {
  DataFreshness,
  ClosedTenderKeywordStat,
  ClosedTenderResult,
  ClosedTenderStatus,
  PaginatedResult,
} from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { DataFreshnessNote } from '@/components/ui-custom/data-freshness-note';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField =
  | 'notifyNo'
  | 'title'
  | 'investor'
  | 'status'
  | 'keyword'
  | 'numBidderJoin'
  | 'winningPrice'
  | 'lastUpdatedAt';

const TEXT_SORT_FIELDS: SortField[] = ['notifyNo', 'title', 'investor', 'keyword'];

const STATUS_LABELS: Record<ClosedTenderStatus, string> = {
  under_evaluation: 'Đang xét thầu',
  awarded: 'Có nhà thầu trúng thầu',
};

function formatCurrency(value: string | null): string {
  if (!value) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${new Intl.NumberFormat('vi-VN').format(num)} VND`;
}

function decisionFileUrl(fileId: string): string {
  return `https://muasamcong.mpi.gov.vn/api/unau/edocproxy/file/share/${fileId}`;
}

export function ClosedTenderListPage() {
  const [detailId, setDetailId] = useState<string | null>(null);

  const { params, setParams } = useUrlParams({
    search: '',
    status: '',
    keyword: '',
    page: 1,
    limit: 20,
    sort: 'lastUpdatedAt' as SortField,
    order: 'desc' as 'asc' | 'desc',
  });

  function handleSort(field: SortField) {
    if (params.sort === field) {
      setParams({ order: params.order === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      setParams({ sort: field, order: TEXT_SORT_FIELDS.includes(field) ? 'asc' : 'desc', page: 1 });
    }
  }

  const { data: keywords } = useQuery({
    queryKey: ['closed-tender-stats-by-keyword'],
    queryFn: async () =>
      (await apiClient.get<ClosedTenderKeywordStat[]>('/closed-tender-stats/by-keyword')).data,
  });

  const { data: freshness } = useQuery({
    queryKey: ['closed-tender-stats-data-freshness'],
    queryFn: async () =>
      (await apiClient.get<DataFreshness>('/closed-tender-stats/data-freshness')).data,
  });

  const { data: resultsPage, isLoading: resultsLoading } = useQuery({
    queryKey: ['closed-tender-results', params],
    queryFn: async () =>
      (
        await apiClient.get<PaginatedResult<ClosedTenderResult>>('/closed-tender-results', {
          params: {
            search: params.search || undefined,
            status: params.status || undefined,
            keyword: params.keyword || undefined,
            page: params.page,
            limit: params.limit,
            sort: params.sort,
            order: params.order,
          },
        })
      ).data,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['closed-tender-results', detailId],
    queryFn: async () => (await apiClient.get<ClosedTenderResult>(`/closed-tender-results/${detailId}`)).data,
    enabled: Boolean(detailId),
  });

  const results = resultsPage?.data ?? [];
  const total = resultsPage?.pagination.total ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Danh sách KQĐT</h1>
        <p className="text-sm text-muted-foreground">
          Gói thầu đã đóng thầu ở trạng thái "Đang xét thầu" hoặc "Có nhà thầu trúng thầu", kèm danh sách nhà
          thầu đã bỏ thầu và kết quả lựa chọn nhà thầu.
        </p>
        <DataFreshnessNote lastCrawledAt={freshness?.lastCrawledAt} label="Dữ liệu KQĐT cập nhật lần cuối lúc" className="mt-1.5" />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[240px] max-w-md flex-1">
          <label className="text-xs font-medium text-muted-foreground">Tìm theo tên gói thầu</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên gói thầu..."
              className="pl-9 h-9 text-sm"
              value={params.search}
              onChange={(e) => setParams({ search: e.target.value, page: 1 })}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Trạng thái</label>
          <Select
            value={params.status || 'all'}
            onValueChange={(val) => setParams({ status: val === 'all' ? '' : val, page: 1 })}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="under_evaluation">Đang xét thầu</SelectItem>
              <SelectItem value="awarded">Có nhà thầu trúng thầu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Từ khoá</label>
          <Select
            value={params.keyword || 'all'}
            onValueChange={(val) => setParams({ keyword: val === 'all' ? '' : val, page: 1 })}
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue placeholder="Tất cả từ khoá" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả từ khoá</SelectItem>
              {keywords?.map((kw) => (
                <SelectItem key={kw.keyword} value={kw.keyword}>
                  {kw.keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {resultsLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="notifyNo" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Mã TBMT
                </SortableHead>
                <SortableHead field="title" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Tên gói thầu
                </SortableHead>
                <SortableHead field="investor" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Chủ đầu tư
                </SortableHead>
                <SortableHead field="keyword" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Từ khoá tìm kiếm
                </SortableHead>
                <SortableHead field="status" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Trạng thái
                </SortableHead>
                <SortableHead field="numBidderJoin" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Số NT bỏ thầu
                </SortableHead>
                <SortableHead field="winningPrice" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Nhà thầu trúng / Giá
                </SortableHead>
                <SortableHead field="lastUpdatedAt" currentSort={params.sort} order={params.order} onSort={handleSort}>
                  Cập nhật
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setDetailId(r.id)}
                >
                  <TableCell className="font-mono text-xs">{r.notifyNo}</TableCell>
                  <TableCell className="max-w-sm truncate" title={r.title}>
                    {r.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{r.investor ?? '-'}</TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[160px] truncate"
                    title={r.matchedKeyword ?? r.keyword.keyword}
                  >
                    {r.matchedKeyword ?? r.keyword.keyword}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'awarded' ? 'success' : 'warning'}>
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{r._count?.bidders ?? r.numBidderJoin ?? '-'}</TableCell>
                  <TableCell className="max-w-xs">
                    {r.winningContractorNames.length > 0 ? (
                      <>
                        <div className="truncate" title={r.winningContractorNames.join(', ')}>
                          {r.winningContractorNames.join(', ')}
                        </div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(r.winningPrice)}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.lastUpdatedAt).toLocaleString('vi-VN')}
                  </TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Chưa có kết quả nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <DataTablePagination
            page={params.page}
            limit={params.limit}
            total={total}
            onPageChange={(p) => setParams({ page: p })}
            onLimitChange={(l) => setParams({ limit: l, page: 1 })}
          />
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={Boolean(detailId)} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.title ?? 'Chi tiết gói thầu'}</DialogTitle>
            <DialogDescription>
              Mã TBMT: {detail?.notifyNo} — {detail && STATUS_LABELS[detail.status]}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang tải...
            </div>
          ) : detail ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Chủ đầu tư: </span>
                  {detail.investor ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Địa phương: </span>
                  {detail.locality ?? '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">Giá gói thầu: </span>
                  {formatCurrency(detail.estimatedValue)}
                </div>
                <div>
                  <span className="text-muted-foreground">Ngày đóng thầu: </span>
                  {detail.bidCloseDate ? new Date(detail.bidCloseDate).toLocaleString('vi-VN') : '-'}
                </div>
                <div>
                  <a
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline underline-offset-2"
                  >
                    Xem trên MuaSamCong ↗
                  </a>
                </div>
              </div>

              {detail.status === 'awarded' && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                  <div className="font-medium">Kết quả lựa chọn nhà thầu</div>
                  <div>
                    <span className="text-muted-foreground">Số quyết định: </span>
                    {detail.decisionNo ?? '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ngày phê duyệt: </span>
                    {detail.decisionDate ? new Date(detail.decisionDate).toLocaleDateString('vi-VN') : '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cơ quan phê duyệt: </span>
                    {detail.decisionAgency ?? '-'}
                  </div>
                  {detail.decisionFileId && (
                    <a
                      href={decisionFileUrl(detail.decisionFileId)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-2"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {detail.decisionFileName ?? 'Quyết định phê duyệt (PDF)'}
                    </a>
                  )}
                </div>
              )}

              <div>
                <div className="font-medium text-sm mb-2">
                  Danh sách nhà thầu bỏ thầu ({detail.bidders?.length ?? 0})
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên nhà thầu</TableHead>
                      <TableHead>Mã số thuế</TableHead>
                      <TableHead>Giá dự thầu</TableHead>
                      <TableHead>Giá cuối</TableHead>
                      <TableHead>Kết quả</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.bidders?.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="max-w-[220px] truncate" title={b.orgFullname}>
                          {b.orgFullname}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.taxCode ?? '-'}</TableCell>
                        <TableCell>{formatCurrency(b.bidPrice)}</TableCell>
                        <TableCell>{formatCurrency(b.finalPrice)}</TableCell>
                        <TableCell>
                          {b.isWinner ? (
                            <Badge variant="success">Trúng thầu</Badge>
                          ) : (
                            <Badge variant="outline">Không trúng</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{b.rankOrReason ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                    {(!detail.bidders || detail.bidders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Chưa có dữ liệu nhà thầu bỏ thầu (gói thầu đang xét thầu, sẽ tự cập nhật ở lần crawl sau).
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableHead({
  field,
  currentSort,
  order,
  onSort,
  children,
}: {
  field: SortField;
  currentSort: SortField;
  order: 'asc' | 'desc';
  onSort: (field: SortField) => void;
  children: ReactNode;
}) {
  const isActive = currentSort === field;
  const Icon = isActive ? (order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground transition-colors',
          isActive && 'text-foreground font-medium',
        )}
      >
        {children}
        <Icon className={cn('h-3.5 w-3.5', !isActive && 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  );
}
