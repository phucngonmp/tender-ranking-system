import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { CrawlJob, Source, SourceType } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ui-custom/confirm-delete-dialog';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { Plus, Pencil, Zap, Trash2, Loader2, Search, Trophy, Sparkles } from 'lucide-react';

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  url: 'URL',
  muasamcong_keyword: 'MuaSamCong',
  bidwinner_keyword: 'Bidwinner',
  dauthauasia_keyword: 'DauThau.Asia',
  gebiz_keyword: 'GeBIZ (Singapore)',
  freetender_keyword: 'FreeTender (Global)',
  samgov_keyword: 'SAM.gov (US Federal)',
};

interface SourceFormState {
  name: string;
  sourceType: SourceType | '';
  keyword: string;
  crawlHour: number;
  minValue: string;
  maxValue: string;
  autoScore: boolean;
}

const EMPTY_FORM: SourceFormState = {
  name: '',
  sourceType: '',
  keyword: '',
  crawlHour: 2,
  minValue: '',
  maxValue: '',
  autoScore: true,
};

function sourceToFormState(s: Source): SourceFormState {
  return {
    name: s.name,
    sourceType: s.sourceType,
    keyword: s.keyword ?? '',
    crawlHour: s.crawlHour,
    minValue: s.minValue ?? '',
    maxValue: s.maxValue ?? '',
    autoScore: s.autoScore ?? true,
  };
}

export function SourcesPage() {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SourceFormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // URL params for persistence
  const { params, setParams } = useUrlParams({
    search: '',
    page: 1,
    limit: 10,
  });

  const { data: sources, isLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => (await apiClient.get<Source[]>('/sources')).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sources'] });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post('/sources', {
        name: form.name,
        sourceType: form.sourceType,
        keyword: form.keyword,
        crawlHour: form.crawlHour,
        minValue: form.minValue === '' ? undefined : Number(form.minValue),
        maxValue: form.maxValue === '' ? undefined : Number(form.maxValue),
        autoScore: form.autoScore,
      }),
    onSuccess: () => {
      setDialogMode(null);
      invalidate();
    },
  });

  const updateFormMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/sources/${editingId}`, {
        name: form.name,
        sourceType: form.sourceType,
        keyword: form.keyword,
        crawlHour: form.crawlHour,
        minValue: form.minValue === '' ? null : Number(form.minValue),
        maxValue: form.maxValue === '' ? null : Number(form.maxValue),
        autoScore: form.autoScore,
      }),
    onSuccess: () => {
      setDialogMode(null);
      setEditingId(null);
      invalidate();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (payload: { id: string; isActive: boolean }) =>
      apiClient.patch(`/sources/${payload.id}`, { isActive: payload.isActive }),
    onSuccess: invalidate,
  });

  const toggleAutoScoreMutation = useMutation({
    mutationFn: async (payload: { id: string; autoScore: boolean; name: string }) =>
      apiClient.patch(`/sources/${payload.id}`, { autoScore: payload.autoScore }),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success(
        variables.autoScore
          ? `Đã bật tự động chấm điểm cho nguồn "${variables.name}"`
          : `Đã tắt tự động chấm điểm cho nguồn "${variables.name}"`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Không thể cập nhật cấu hình chấm điểm');
    },
  });

  const batchToggleAutoScoreMutation = useMutation({
    mutationFn: async (autoScore: boolean) => {
      const promises = (sources ?? []).map((s) =>
        apiClient.patch(`/sources/${s.id}`, { autoScore })
      );
      await Promise.all(promises);
    },
    onSuccess: (_, autoScore) => {
      invalidate();
      toast.success(
        autoScore
          ? 'Đã bật tự động chấm điểm cho tất cả nguồn'
          : 'Đã tắt tự động chấm điểm cho tất cả nguồn'
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật hàng loạt');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/sources/${id}`),
    onSuccess: () => {
      setDeleteId(null);
      invalidate();
    },
  });

  // In-flight tracking per source ID (for instant optimistic feedback on clicked buttons)
  const [inFlightCrawlIds, setInFlightCrawlIds] = useState<Set<string>>(new Set());
  const [inFlightKqdtIds, setInFlightKqdtIds] = useState<Set<string>>(new Set());

  // Query recent crawl jobs with dynamic polling so running background jobs keep spinning
  const { data: crawlJobs } = useQuery({
    queryKey: ['crawl-jobs', 'active-tracker'],
    queryFn: async () => (await apiClient.get<CrawlJob[]>('/crawl-jobs', { params: { limit: 50 } })).data,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.some(
        (j) => j.status === 'pending' || j.status === 'running'
      );
      return hasActive ? 3_000 : 15_000;
    },
  });

  // Set of source IDs that currently have a pending or running crawl job
  const activeCrawlSourceIds = useMemo(() => {
    const ids = new Set<string>();
    if (crawlJobs) {
      for (const job of crawlJobs) {
        if (job.status === 'pending' || job.status === 'running') {
          ids.add(job.sourceId);
        }
      }
    }
    return ids;
  }, [crawlJobs]);

  // When active jobs finish, automatically refresh sources list to update lastCrawledAt
  const prevActiveCountRef = useRef<number>(0);
  useEffect(() => {
    const currentActiveCount = activeCrawlSourceIds.size;
    if (prevActiveCountRef.current > 0 && currentActiveCount < prevActiveCountRef.current) {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    }
    prevActiveCountRef.current = currentActiveCount;
  }, [activeCrawlSourceIds, queryClient]);

  const handleCrawlNow = async (sourceId: string) => {
    setInFlightCrawlIds((prev) => new Set(prev).add(sourceId));
    try {
      await apiClient.post(`/sources/${sourceId}/crawl-now`);
      await queryClient.invalidateQueries({ queryKey: ['crawl-jobs'] });
    } catch (err) {
      console.error(`Failed to trigger crawl for source ${sourceId}:`, err);
    } finally {
      setInFlightCrawlIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  const handleCrawlKqdt = async (sourceId: string) => {
    setInFlightKqdtIds((prev) => new Set(prev).add(sourceId));
    try {
      await apiClient.post(`/closed-tender-keywords/crawl-by-source/${sourceId}`);
      await queryClient.invalidateQueries({ queryKey: ['closed-tender-crawl-jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['sources'] });
    } catch (err) {
      console.error(`Failed to trigger KQDT crawl for source ${sourceId}:`, err);
    } finally {
      setInFlightKqdtIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogMode('create');
  }

  function openEditDialog(source: Source) {
    setForm(sourceToFormState(source));
    setEditingId(source.id);
    setDialogMode('edit');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dialogMode === 'edit') updateFormMutation.mutate();
    else createMutation.mutate();
  }

  const isSaving = createMutation.isPending || updateFormMutation.isPending;

  // Filter sources
  const filteredSources = sources?.filter(
    (s) =>
      s.name.toLowerCase().includes(params.search.toLowerCase()) ||
      (s.keyword && s.keyword.toLowerCase().includes(params.search.toLowerCase())) ||
      (s.url && s.url.toLowerCase().includes(params.search.toLowerCase()))
  );

  const total = filteredSources?.length || 0;
  const paginatedSources = filteredSources?.slice(
    (params.page - 1) * params.limit,
    params.page * params.limit
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Nguồn crawl</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý các nguồn dữ liệu thu thập và cấu hình tự động chấm điểm AI sau khi crawl.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sources && sources.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Tự động chấm điểm:</span>
              <span className="font-semibold text-foreground">
                {sources.filter((s) => s.autoScore !== false).length}/{sources.length} nguồn bật
              </span>
              <span className="text-muted-foreground/40 mx-0.5">|</span>
              <button
                type="button"
                onClick={() => batchToggleAutoScoreMutation.mutate(true)}
                disabled={batchToggleAutoScoreMutation.isPending}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                Bật tất cả
              </button>
              <span className="text-muted-foreground/40">/</span>
              <button
                type="button"
                onClick={() => batchToggleAutoScoreMutation.mutate(false)}
                disabled={batchToggleAutoScoreMutation.isPending}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline font-medium cursor-pointer"
              >
                Tắt tất cả
              </button>
            </div>
          )}

          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4" />
            Thêm nguồn mới
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 min-w-[240px] max-w-md flex-1">
          <label className="text-xs font-medium text-muted-foreground">Từ khoá / URL / Tên nguồn</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, từ khoá hoặc URL..."
              className="pl-9 h-9 text-sm"
              value={params.search}
              onChange={(e) => setParams({ search: e.target.value, page: 1 })}
            />
          </div>
        </div>
      </div>

      {/* Table */}
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
                <TableHead>Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>URL / Từ khoá</TableHead>
                <TableHead>Giờ chạy</TableHead>
                <TableHead>Kích hoạt</TableHead>
                <TableHead>Chấm điểm tự động</TableHead>
                <TableHead>Crawl gần nhất</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSources?.map((source) => {
                const isCrawling = inFlightCrawlIds.has(source.id) || activeCrawlSourceIds.has(source.id);
                const isKqdtCrawling = inFlightKqdtIds.has(source.id);
                return (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {SOURCE_TYPE_LABELS[source.sourceType]}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {source.sourceType !== 'url' ? (
                      <em className="text-muted-foreground">{source.keyword}</em>
                    ) : (
                      <a
                        href={source.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline underline-offset-2 truncate block"
                      >
                        {source.url}
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {String(source.crawlHour).padStart(2, '0')}:00
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={source.isActive}
                      className="h-4 w-4 accent-primary cursor-pointer"
                      onChange={(e) =>
                        toggleActiveMutation.mutate({ id: source.id, isActive: e.target.checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={source.autoScore ?? true}
                        onCheckedChange={(checked) =>
                          toggleAutoScoreMutation.mutate({
                            id: source.id,
                            autoScore: checked,
                            name: source.name,
                          })
                        }
                      />
                      <span className="text-xs font-medium">
                        {(source.autoScore ?? true) ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Sparkles className="h-3 w-3 text-amber-500 inline" />
                            Bật
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Tắt</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isCrawling ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang crawl...
                      </span>
                    ) : source.lastCrawledAt ? (
                      new Date(source.lastCrawledAt).toLocaleString('vi-VN')
                    ) : (
                      'Chưa crawl'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleCrawlNow(source.id)}
                        disabled={isCrawling}
                        className={isCrawling ? "text-blue-600 border-blue-200 bg-blue-50/60 dark:bg-blue-950/30" : ""}
                      >
                        {isCrawling ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                            Đang crawl...
                          </>
                        ) : (
                          <>
                            <Zap className="h-3.5 w-3.5" />
                            Crawl ngay
                          </>
                        )}
                      </Button>
                      {source.sourceType === 'muasamcong_keyword' && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleCrawlKqdt(source.id)}
                          disabled={isKqdtCrawling}
                          className={isKqdtCrawling ? "text-amber-600 border-amber-200 bg-amber-50/60 dark:bg-amber-950/30" : ""}
                          title="Crawl gói thầu đã đóng thầu (Đang xét thầu / Có nhà thầu trúng thầu) — không chấm điểm AI"
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          Crawl KQĐT
                        </Button>
                      )}
                      <Button variant="outline" size="xs" onClick={() => openEditDialog(source)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => setDeleteId(source.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {paginatedSources?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Chưa có nguồn crawl nào.
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? 'Sửa nguồn crawl' : 'Thêm nguồn crawl mới'}</DialogTitle>
            <DialogDescription>
              Nhập thông tin cấu hình cho nguồn dữ liệu hoặc từ khoá cần thu thập.
            </DialogDescription>
          </DialogHeader>

          <form id="source-form" onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Tên nguồn</label>
              <Input
                placeholder="Ví dụ: Mua Sắm Công - CNTT"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Loại nguồn</label>
                <Select
                  value={form.sourceType}
                  onValueChange={(val) => setForm({ ...form, sourceType: val as SourceType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nguồn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="muasamcong_keyword">MuaSamCong</SelectItem>
                    <SelectItem value="bidwinner_keyword">Bidwinner</SelectItem>
                    <SelectItem value="dauthauasia_keyword">DauThau.Asia</SelectItem>
                    <SelectItem value="gebiz_keyword">GeBIZ (Singapore)</SelectItem>
                    <SelectItem value="freetender_keyword">FreeTender (Global)</SelectItem>
                      <SelectItem value="samgov_keyword">SAM.gov (US Federal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Giờ chạy hằng ngày</label>
                <Select
                  value={String(form.crawlHour)}
                  onValueChange={(val) => setForm({ ...form, crawlHour: Number(val) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Từ khoá</label>
              <Input
                placeholder="Ví dụ: chuyển đổi số, AI, blockchain"
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Có thể nhập nhiều từ khoá, cách nhau bằng dấu phẩy (,). Hệ thống sẽ tìm kiếm lần lượt theo từng từ khoá khi crawl.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Giá trị tối thiểu (VND)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Không giới hạn"
                  value={form.minValue}
                  onChange={(e) => setForm({ ...form, minValue: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Giá trị tối đa (VND)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Không giới hạn"
                  value={form.maxValue}
                  onChange={(e) => setForm({ ...form, maxValue: e.target.value })}
                />
              </div>
              <p className="col-span-full text-xs text-muted-foreground -mt-1">
                Chỉ giữ lại gói thầu có giá trị nằm trong khoảng này khi crawl. Để trống ô nào thì không giới hạn phía đó.
              </p>
            </div>

            {/* Auto Score after Crawl Option */}
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3 shadow-xs">
              <div className="space-y-0.5 pr-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Tự động chấm điểm AI sau khi crawl</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Khi bật, các gói thầu mới hoặc cập nhật từ nguồn này sẽ tự động được đưa vào hàng đợi chấm điểm AI ngay sau khi crawl hoàn tất.
                </p>
              </div>
              <Switch
                id="autoScore"
                checked={form.autoScore}
                onCheckedChange={(checked) => setForm({ ...form, autoScore: checked })}
              />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="source-form"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu nguồn'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Xác nhận xóa nguồn"
        description="Bạn có chắc chắn muốn xóa nguồn này không? Các gói thầu đã crawl từ nguồn này có thể bị ảnh hưởng."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
