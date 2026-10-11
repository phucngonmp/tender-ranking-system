import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ScoringHistory, ScoringStatus } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABELS: Record<ScoringStatus, string> = {
  pending: 'Đang chờ',
  success: 'Thành công',
  failed: 'Thất bại',
};

const STATUS_VARIANT: Record<ScoringStatus, 'success' | 'destructive' | 'pending'> = {
  success: 'success',
  failed: 'destructive',
  pending: 'pending',
};

export function ScoringHistoriesPage() {
  const { params, setParams } = useUrlParams({
    status: '',
    page: 1,
    limit: 10,
  });

  const { data: histories, isLoading } = useQuery({
    queryKey: ['scoring-histories', params],
    queryFn: async () =>
      (
        await apiClient.get<ScoringHistory[]>('/scoring-histories', {
          params: {
            status: params.status || undefined,
          },
        })
      ).data,
    refetchInterval: 10_000,
  });

  // Client-side pagination if backend API returns array directly
  const total = histories?.length || 0;
  const paginatedHistories = histories?.slice(
    (params.page - 1) * params.limit,
    params.page * params.limit
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Lịch sử chấm điểm</h1>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Trạng thái</label>
          <Select
            value={params.status || 'all'}
            onValueChange={(val) =>
              setParams({ status: (val === 'all' ? '' : val) as ScoringStatus | '', page: 1 })
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead className="w-[30%]">Gói thầu</TableHead>
                <TableHead>Model AI</TableHead>
                <TableHead>Điểm</TableHead>
                <TableHead>Token (Prompt/Comp/Total)</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lỗi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistories?.map((history) => (
                <TableRow key={history.id}>
                  <TableCell className="whitespace-nowrap font-medium text-sm">
                    {history.startedAt ? new Date(history.startedAt).toLocaleString('vi-VN') : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {history.tender ? (
                      <Link to={`/tenders/${history.tender.id}`} className="text-blue-600 hover:underline line-clamp-2" title={history.tender.title}>
                        {history.tender.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">Gói thầu đã xóa hoặc lỗi</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {history.modelUsed}
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {history.score ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {history.totalTokens ? (
                      <span>{history.promptTokens} / {history.completionTokens} / <strong>{history.totalTokens}</strong></span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[history.status]}>
                      {STATUS_LABELS[history.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-destructive text-xs">
                    <span className="line-clamp-2" title={history.errorMessage || ''}>
                      {history.errorMessage ?? '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedHistories?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Chưa có lịch sử chấm điểm nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* DataTablePagination */}
          <DataTablePagination
            page={params.page}
            limit={params.limit}
            total={total}
            onPageChange={(p) => setParams({ page: p })}
            onLimitChange={(l) => setParams({ limit: l, page: 1 })}
          />
        </>
      )}
    </div>
  );
}
