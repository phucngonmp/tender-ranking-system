import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { CriteriaProfile } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Pencil, CheckCircle2, Trash2, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(', ');
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

interface ProfileFormState {
  name: string;
  industries: string;
  technologies: string;
  products: string;
  keywords: string;
  preferredValueMin: string;
  preferredValueMax: string;
  positioning: string;
  services: string;
  productsAndSolutions: string;
  industriesExperience: string;
  certifications: string;
  marketsAndLanguages: string;
  deliveryModel: string;
}

const EMPTY_FORM: ProfileFormState = {
  name: '',
  industries: '',
  technologies: '',
  products: '',
  keywords: '',
  preferredValueMin: '',
  preferredValueMax: '',
  positioning: '',
  services: '',
  productsAndSolutions: '',
  industriesExperience: '',
  certifications: '',
  marketsAndLanguages: '',
  deliveryModel: '',
};

function profileToFormState(p: CriteriaProfile): ProfileFormState {
  return {
    name: p.name,
    industries: joinTags(p.industries),
    technologies: joinTags(p.technologies),
    products: joinTags(p.products),
    keywords: joinTags(p.keywords),
    preferredValueMin: p.preferredValueMin?.toString() ?? '',
    preferredValueMax: p.preferredValueMax?.toString() ?? '',
    positioning: p.positioning ?? '',
    services: joinTags(p.services),
    productsAndSolutions: joinTags(p.productsAndSolutions),
    industriesExperience: joinTags(p.industriesExperience),
    certifications: joinTags(p.certifications),
    marketsAndLanguages: joinTags(p.marketsAndLanguages),
    deliveryModel: p.deliveryModel ?? '',
  };
}

function formStateToPayload(f: ProfileFormState) {
  return {
    name: f.name,
    industries: parseTags(f.industries),
    technologies: parseTags(f.technologies),
    products: parseTags(f.products),
    keywords: parseTags(f.keywords),
    preferredValueMin: f.preferredValueMin ? Number(f.preferredValueMin) : undefined,
    preferredValueMax: f.preferredValueMax ? Number(f.preferredValueMax) : undefined,
    positioning: f.positioning.trim() || undefined,
    services: parseTags(f.services),
    productsAndSolutions: parseTags(f.productsAndSolutions),
    industriesExperience: parseTags(f.industriesExperience),
    certifications: parseTags(f.certifications),
    marketsAndLanguages: parseTags(f.marketsAndLanguages),
    deliveryModel: f.deliveryModel.trim() || undefined,
  };
}

export function CriteriaProfilesPage() {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);

  const { params, setParams } = useUrlParams({
    search: '',
    page: 1,
    limit: 10,
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['criteria-profiles'],
    queryFn: async () => (await apiClient.get<CriteriaProfile[]>('/criteria-profiles')).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['criteria-profiles'] });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post('/criteria-profiles', formStateToPayload(form)),
    onSuccess: () => {
      setDialogMode(null);
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/criteria-profiles/${editingId}`, formStateToPayload(form)),
    onSuccess: () => {
      setDialogMode(null);
      setEditingId(null);
      invalidate();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/criteria-profiles/${id}/activate`),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/criteria-profiles/${id}`),
    onSuccess: () => {
      setDeleteId(null);
      invalidate();
    },
  });

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDialogMode('create');
  }

  function openEditDialog(profile: CriteriaProfile) {
    setForm(profileToFormState(profile));
    setEditingId(profile.id);
    setDialogMode('edit');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dialogMode === 'edit') {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredProfiles = profiles?.filter((p) =>
    p.name.toLowerCase().includes(params.search.toLowerCase())
  );

  const total = filteredProfiles?.length || 0;
  const paginatedProfiles = filteredProfiles?.slice(
    (params.page - 1) * params.limit,
    params.page * params.limit
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Hồ sơ công ty</h1>
        <p className="text-sm text-muted-foreground">
          Mỗi hồ sơ đại diện cho một công ty, gộp chung tiêu chí đối chiếu gói thầu và năng lực
          dùng làm bối cảnh cho AI. Kích hoạt một hồ sơ sẽ áp dụng đồng bộ cả hai cho toàn hệ
          thống.
        </p>
      </div>

      {/* Filter & Action */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[240px] max-w-md flex-1">
            <label className="text-xs font-medium text-muted-foreground">Tên công ty / hồ sơ</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm hồ sơ..."
                className="pl-9 h-9 text-sm"
                value={params.search}
                onChange={(e) => setParams({ search: e.target.value, page: 1 })}
              />
            </div>
          </div>
        </div>

        <div>
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
            onClick={openCreateDialog}
          >
            <Plus className="h-4 w-4" />
            Tạo hồ sơ mới
          </Button>
        </div>
      </div>

      {/* Profile cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedProfiles?.map((profile) => (
              <Card
                key={profile.id}
                className={cn(
                  'transition-colors',
                  profile.isActive && 'border-emerald-400 bg-emerald-50/40'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <CardTitle>{profile.name}</CardTitle>
                      {profile.isActive && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Đang áp dụng
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!profile.isActive && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => activateMutation.mutate(profile.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Kích hoạt
                        </Button>
                      )}
                      <Button variant="outline" size="xs" onClick={() => openEditDialog(profile)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => setDeleteId(profile.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xoá
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.positioning && (
                    <p className="text-sm text-muted-foreground">{profile.positioning}</p>
                  )}
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: 'Ngành nghề (tiêu chí)', tags: profile.industries },
                      { label: 'Công nghệ (tiêu chí)', tags: profile.technologies },
                      { label: 'Sản phẩm (tiêu chí)', tags: profile.products },
                      { label: 'Từ khoá (tiêu chí)', tags: profile.keywords },
                      { label: 'Dịch vụ chính', tags: profile.services },
                      { label: 'Sản phẩm/giải pháp', tags: profile.productsAndSolutions },
                      { label: 'Ngành đã triển khai', tags: profile.industriesExperience },
                      { label: 'Chứng nhận/giải thưởng', tags: profile.certifications },
                      { label: 'Thị trường/ngôn ngữ', tags: profile.marketsAndLanguages },
                    ].map(({ label, tags }) => (
                      <div key={label}>
                        <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {label}
                        </dt>
                        <dd>
                          <TagList tags={tags} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {profile.deliveryModel && (
                    <div>
                      <dt className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Mô hình triển khai
                      </dt>
                      <dd className="text-sm text-muted-foreground">{profile.deliveryModel}</dd>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {paginatedProfiles?.length === 0 && (
              <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
                Không tìm thấy hồ sơ nào.
              </div>
            )}
          </div>

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
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? 'Sửa hồ sơ công ty' : 'Tạo hồ sơ công ty mới'}</DialogTitle>
            <DialogDescription>
              Hồ sơ dùng để vừa đối chiếu/chấm điểm gói thầu, vừa làm bối cảnh năng lực cho AI khi
              được kích hoạt.
            </DialogDescription>
          </DialogHeader>

          <form id="profile-form" onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Tên công ty / hồ sơ <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Ví dụ: Công ty Cổ phần Công nghệ Toàn Cầu"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Vị thế / giới thiệu ngắn</label>
              <Textarea
                placeholder="Vị thế công ty trên thị trường..."
                value={form.positioning}
                onChange={(e) => setForm({ ...form, positioning: e.target.value })}
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
              Tiêu chí đối chiếu gói thầu
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Ngành nghề <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="CNTT, Viễn thông"
                  value={form.industries}
                  onChange={(e) => setForm({ ...form, industries: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Công nghệ <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="React, Node.js, AI"
                  value={form.technologies}
                  onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Sản phẩm <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="Phần mềm, CRM, Website"
                  value={form.products}
                  onChange={(e) => setForm({ ...form, products: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Từ khoá <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="chuyển đổi số, phần mềm"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Giá trị tối thiểu (VND)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.preferredValueMin}
                  onChange={(e) => setForm({ ...form, preferredValueMin: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Giá trị tối đa (VND)</label>
                <Input
                  type="number"
                  placeholder="Không giới hạn"
                  value={form.preferredValueMax}
                  onChange={(e) => setForm({ ...form, preferredValueMax: e.target.value })}
                />
              </div>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
              Hồ sơ năng lực (bối cảnh cho AI)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Dịch vụ chính <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="Tư vấn, triển khai..."
                  value={form.services}
                  onChange={(e) => setForm({ ...form, services: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Sản phẩm/giải pháp <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="Sản phẩm, giải pháp đặc trưng"
                  value={form.productsAndSolutions}
                  onChange={(e) => setForm({ ...form, productsAndSolutions: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Ngành đã triển khai <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="Y tế, Ô tô, Xây dựng..."
                  value={form.industriesExperience}
                  onChange={(e) => setForm({ ...form, industriesExperience: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Chứng nhận/giải thưởng <span className="text-xs text-muted-foreground">(phẩy)</span>
                </label>
                <Input
                  placeholder="ISO 9001, Sao Khuê..."
                  value={form.certifications}
                  onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Thị trường/ngôn ngữ <span className="text-xs text-muted-foreground">(phẩy)</span>
              </label>
              <Input
                placeholder="Việt Nam, Nhật Bản..."
                value={form.marketsAndLanguages}
                onChange={(e) => setForm({ ...form, marketsAndLanguages: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Mô hình triển khai</label>
              <Textarea
                placeholder="Mô tả cách công ty triển khai dự án..."
                value={form.deliveryModel}
                onChange={(e) => setForm({ ...form, deliveryModel: e.target.value })}
              />
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
              Hủy
            </Button>
            <Button type="submit" form="profile-form" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu hồ sơ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Xác nhận xóa hồ sơ"
        description="Bạn có chắc chắn muốn xóa hồ sơ này không? Việc xóa có thể ảnh hưởng đến kết quả đánh giá gói thầu."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
