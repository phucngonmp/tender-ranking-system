import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ClosedTenderCrawlJob, ClosedTenderKeyword, CrawlJobStatus } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { Loader2 } from 'lucide-react';

const STATUS_LABELS: Record<CrawlJobStatus, string> = {
  pending: 'Đang chờ',
  running: 'Đang chạy',
  success: 'Thành công',
  failed: 'Thất bại',
};

const STATUS_VARIANT: Record<CrawlJobStatus, 'success' | 'warning' | 'destructive' | 'pending'> = {
  success: 'success',
  running: 'warning',
  failed: 'destructive',
  pending: 'pending',
};

export function ClosedTenderCrawlJobsPage() {
  const { params, setParams } = useUrlParams({
    keywordId: '',
    status: '',
    page: 1,
    limit: 10,
  });

  const { data: keywords } = useQuery({
    queryKey: ['closed-tender-keywords'],
    queryFn: async () => (await apiClient.get<ClosedTenderKeyword[]>('/closed-tender-keywords')).data,
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['closed-tender-crawl-jobs', params.keywordId],
    queryFn: async () =>
      (
        await apiClient.get<ClosedTenderCrawlJob[]>('/closed-tender-keywords/crawl-jobs', {
          params: { keyword_id: params.keywordId || undefined },
        })
      ).data,
    refetchInterval: 10_000,
  });

  const filteredJobs = jobs?.filter((job) => !params.status || job.status === params.status);
  const total = filteredJobs?.length || 0;
  const paginatedJobs = filteredJobs?.slice((params.page - 1) * params.limit, params.page * params.limit);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Lịch sử crawl KQĐT</h1>
        <p className="text-sm text-muted-foreground">
          Lịch sử các lần thu thập dữ liệu kết quả đấu thầu (Đang xét thầu / Có nhà thầu trúng thầu) theo
          từng từ khoá theo dõi.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[220px]">
          <label className="text-xs font-medium text-muted-foreground">Từ khoá</label>
          <Select
            value={params.keywordId || 'all'}
            onValueChange={(val) => setParams({ keywordId: val === 'all' ? '' : val, page: 1 })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {keywords?.map((kw) => (
                <SelectItem key={kw.id} value={kw.id}>
                  {kw.keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground">Trạng thái</label>
          <Select
            value={params.status || 'all'}
            onValueChange={(val) =>
              setParams({ status: (val === 'all' ? '' : val) as CrawlJobStatus | '', page: 1 })
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
                <TableHead>Từ khoá</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Số gói thầu tìm thấy</TableHead>
                <TableHead>Bắt đầu</TableHead>
                <TableHead>Kết thúc</TableHead>
                <TableHead>Lỗi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedJobs?.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.keyword.keyword}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[job.status]}>{STATUS_LABELS[job.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.itemsFound}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {job.startedAt ? new Date(job.startedAt).toLocaleString('vi-VN') : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {job.finishedAt ? new Date(job.finishedAt).toLocaleString('vi-VN') : '-'}
                  </TableCell>
                  <TableCell className="max-w-xs text-destructive text-xs">{job.errorMessage ?? '-'}</TableCell>
                </TableRow>
              ))}
              {paginatedJobs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Chưa có job crawl nào.
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
    </div>
  );
}
