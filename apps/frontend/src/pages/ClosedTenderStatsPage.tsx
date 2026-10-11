import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import {
  ClosedTenderCompanyStat,
  DataFreshness,
  ClosedTenderKeywordStat,
  ClosedTenderStatsSummary,
  ClosedTenderStatus,
  PaginatedResult,
} from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { StatTile } from '@/components/ui-custom/stat-tile';
import { HBarChart } from '@/components/ui-custom/h-bar-chart';
import { DataFreshnessNote } from '@/components/ui-custom/data-freshness-note';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, Loader2, Search, Trophy, FileStack, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<ClosedTenderStatus, string> = {
  under_evaluation: 'Đang xét thầu',
  awarded: 'Có nhà thầu trúng thầu',
};

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return '-';
  return `${new Intl.NumberFormat('vi-VN').format(num)} VND`;
}

function formatCount(value: string | number): string {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('vi-VN').format(num);
}

function formatValueTiles(value: string | number): string {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return '-';
  const billions = num / 1_000_000_000;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(billions)} tỷ VND`;
}

type CompanySortField = 'bid_count' | 'win_count' | 'win_rate' | 'total_winning_value';

export function ClosedTenderStatsPage() {
  const navigate = useNavigate();

  const { params, setParams } = useUrlParams({
    search: '',
    keyword: '',
    status: '',
    page: 1,
    limit: 10,
    sort: 'win_count' as CompanySortField,
    order: 'desc' as 'asc' | 'desc',
  });

  function handleSort(field: CompanySortField) {
    if (params.sort === field) {
      setParams({ order: params.order === 'asc' ? 'desc' : 'asc', page: 1 });
    } else {
      setParams({ sort: field, order: 'desc', page: 1 });
    }
  }

  const { data: freshness } = useQuery({
    queryKey: ['closed-tender-stats-data-freshness'],
    queryFn: async () =>
      (await apiClient.get<DataFreshness>('/closed-tender-stats/data-freshness')).data,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['closed-tender-stats-summary', params.keyword, params.status],
    queryFn: async () =>
      (
        await apiClient.get<ClosedTenderStatsSummary>('/closed-tender-stats/summary', {
          params: { keyword: params.keyword || undefined, status: params.status || undefined },
        })
      ).data,
  });

  const { data: byKeyword } = useQuery({
    queryKey: ['closed-tender-stats-by-keyword'],
    queryFn: async () =>
      (await apiClient.get<ClosedTenderKeywordStat[]>('/closed-tender-stats/by-keyword')).data,
  });

  const { data: topWinners } = useQuery({
    queryKey: ['closed-tender-stats-top-winners', params.keyword, params.status],
    queryFn: async () =>
      (
        await apiClient.get<ClosedTenderCompanyStat[]>('/closed-tender-stats/top-winners', {
          params: { limit: 8, keyword: params.keyword || undefined, status: params.status || undefined },
        })
      ).data,
  });

  const { data: companiesPage, isLoading: companiesLoading } = useQuery({
    queryKey: ['closed-tender-stats-companies', params],
    queryFn: async () =>
      (
        await apiClient.get<PaginatedResult<ClosedTenderCompanyStat>>('/closed-tender-stats/companies', {
          params: {
            search: params.search || undefined,
            keyword: params.keyword || undefined,
            status: params.status || undefined,
            sort: params.sort,
            order: params.order,
            page: params.page,
            limit: params.limit,
          },
        })
      ).data,
  });

  const companies = companiesPage?.data ?? [];
  const companiesTotal = companiesPage?.pagination.total ?? 0;

  const maxKeywordCount = Math.max(1, ...(byKeyword?.map((k) => k.totalCount) ?? [1]));
  const maxWinCount = Math.max(1, ...(topWinners?.map((c) => c.winCount) ?? [1]));

  function openCompanyDetail(c: ClosedTenderCompanyStat) {
    navigate(`/closed-tender-stats/company/${encodeURIComponent(c.companyKey)}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Báo cáo & Đối thủ cạnh tranh</h1>
        <p className="text-sm text-muted-foreground">
          Thống kê gói thầu theo từ khoá và các công ty đã bỏ thầu / trúng thầu, tổng hợp từ dữ liệu KQĐT đã
          crawl.
        </p>
        <DataFreshnessNote lastCrawledAt={freshness?.lastCrawledAt} label="Dữ liệu KQĐT cập nhật lần cuối lúc" className="mt-1.5" />
      </div>

      {/* Bộ lọc chung — áp dụng cho KPI, biểu đồ top công ty và bảng xếp hạng.
          Biểu đồ "Số gói thầu theo từ khoá" luôn hiển thị đầy đủ để làm bối cảnh
          đối chiếu, không bị lọc theo. */}
      <div className="flex flex-wrap items-end gap-3">
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
              {byKeyword?.map((kw) => (
                <SelectItem key={kw.keyword} value={kw.keyword}>
                  {kw.keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <SelectItem value="under_evaluation">{STATUS_LABELS.under_evaluation}</SelectItem>
              <SelectItem value="awarded">{STATUS_LABELS.awarded}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(params.keyword || params.status) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => setParams({ keyword: '', status: '', page: 1 })}
          >
            Xoá bộ lọc
          </Button>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={FileStack}
          label="Tổng số gói thầu"
          value={summaryLoading ? '…' : formatCount(summary?.totalTenders ?? 0)}
        />
        <StatTile
          icon={Trophy}
          label="Đã có KQLCNT"
          value={summaryLoading ? '…' : formatCount(summary?.awardedTenders ?? 0)}
        />
        <StatTile
          icon={Building2}
          label="Công ty tham gia"
          value={summaryLoading ? '…' : formatCount(summary?.totalCompanies ?? 0)}
        />
        <StatTile
          icon={Percent}
          label="Tổng giá trị trúng thầu"
          value={summaryLoading ? '…' : formatValueTiles(summary?.totalWinningValue ?? 0)}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Số gói thầu theo từ khoá</CardTitle>
            <CardDescription>Tổng số gói thầu đã đóng thầu thu thập được cho mỗi từ khoá theo dõi.</CardDescription>
          </CardHeader>
          <CardContent>
            {!byKeyword || byKeyword.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
            ) : (
              <HBarChart
                items={byKeyword.map((k) => ({
                  label: k.keyword,
                  value: k.totalCount,
                  title: `${k.keyword}: ${k.totalCount} gói (${k.awardedCount} đã có KQLCNT)`,
                }))}
                max={maxKeywordCount}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top công ty theo số lần trúng thầu</CardTitle>
            <CardDescription>8 công ty trúng thầu nhiều nhất trong dữ liệu đã crawl. Bấm vào 1 công ty ở bảng bên dưới để xem phân tích chi tiết.</CardDescription>
          </CardHeader>
          <CardContent>
            {!topWinners || topWinners.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
            ) : (
              <HBarChart
                items={topWinners.map((c) => ({
                  label: c.orgFullname,
                  value: c.winCount,
                  title: `${c.orgFullname}: trúng ${c.winCount}/${c.bidCount} lần bỏ thầu (${c.winRate}%)`,
                }))}
                max={maxWinCount}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company leaderboard */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Bảng xếp hạng công ty</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[240px] max-w-md flex-1">
            <label className="text-xs font-medium text-muted-foreground">Tìm theo tên công ty</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên công ty..."
                className="pl-9 h-9 text-sm"
                value={params.search}
                onChange={(e) => setParams({ search: e.target.value, page: 1 })}
              />
            </div>
          </div>
        </div>

        {companiesLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên công ty</TableHead>
                  <TableHead>Mã số thuế</TableHead>
                  <SortableHead field="bid_count" currentSort={params.sort} order={params.order} onSort={handleSort}>
                    Số lần bỏ thầu
                  </SortableHead>
                  <SortableHead field="win_count" currentSort={params.sort} order={params.order} onSort={handleSort}>
                    Số lần trúng
                  </SortableHead>
                  <SortableHead field="win_rate" currentSort={params.sort} order={params.order} onSort={handleSort}>
                    Tỷ lệ trúng
                  </SortableHead>
                  <SortableHead
                    field="total_winning_value"
                    currentSort={params.sort}
                    order={params.order}
                    onSort={handleSort}
                  >
                    Tổng giá trị trúng
                  </SortableHead>
                  <TableHead>Số từ khoá</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow
                    key={c.companyKey}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openCompanyDetail(c)}
                  >
                    <TableCell className="font-medium max-w-xs whitespace-normal break-words leading-snug">
                      {c.orgFullname}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.taxCode ?? '-'}</TableCell>
                    <TableCell className="text-center">{c.bidCount}</TableCell>
                    <TableCell className="text-center">{c.winCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.winRate >= 50 ? 'success' : c.winRate > 0 ? 'warning' : 'outline'}>
                        {c.winRate}%
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(c.totalWinningValue)}</TableCell>
                    <TableCell className="text-center">{c.keywordCount}</TableCell>
                  </TableRow>
                ))}
                {companies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Chưa có công ty nào phù hợp bộ lọc.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <DataTablePagination
              page={params.page}
              limit={params.limit}
              total={companiesTotal}
              onPageChange={(p) => setParams({ page: p })}
              onLimitChange={(l) => setParams({ limit: l, page: 1 })}
            />
          </>
        )}
      </div>
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
  field: CompanySortField;
  currentSort: CompanySortField;
  order: 'asc' | 'desc';
  onSort: (field: CompanySortField) => void;
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
