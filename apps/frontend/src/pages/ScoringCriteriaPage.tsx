import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import {
  ScoringAggregation,
  ScoringCriteriaGroup,
  ScoringCriteriaTier,
  ScoringEvaluatorType,
  ScoringFieldMetadata,
} from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ui-custom/confirm-delete-dialog';
import { Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown, Sparkles, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

const EVALUATOR_LABELS: Record<ScoringEvaluatorType, string> = {
  numeric_range: 'Khoảng số',
  list_match: 'Danh sách chứa',
  date_diff_gte: 'Chênh lệch ngày',
  ai_classification: 'AI phân loại',
};

const AGGREGATION_LABELS: Record<ScoringAggregation, string> = {
  best_tier: 'Chọn mức khớp cao nhất',
  flat_if_any: 'Đạt 1 trong các mức → cộng cố định',
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

function summarizeTierConfig(tier: ScoringCriteriaTier): string {
  const config = tier.config ?? {};
  switch (tier.evaluatorType) {
    case 'numeric_range': {
      const { min, max, minExclusive, maxExclusive } = config;
      if (min === undefined && max === undefined) return '(mọi giá trị — mức mặc định)';
      const parts: string[] = [];
      if (min !== undefined) parts.push(`${minExclusive ? '>' : '≥'} ${formatNumber(min)}`);
      if (max !== undefined) parts.push(`${maxExclusive ? '<' : '≤'} ${formatNumber(max)}`);
      return parts.join(' và ');
    }
    case 'list_match': {
      const values: string[] = config.values ?? [];
      if (values.length === 0) return '(mọi giá trị — mức mặc định)';
      return `chứa: ${values.join(', ')}`;
    }
    case 'date_diff_gte':
      return `≥ ${config.days ?? 14} ngày`;
    case 'ai_classification':
      return `AI: ${tier.aiQuestionKey} = ${JSON.stringify(config.aiValue)}`;
    default:
      return '-';
  }
}

interface TierFormState {
  label: string;
  points: string;
  evaluatorType: ScoringEvaluatorType;
  targetField: string;
  aiQuestionKey: string;
  min: string;
  max: string;
  minExclusive: boolean;
  maxExclusive: boolean;
  values: string;
  days: string;
  aiValue: string;
}

const EMPTY_TIER_FORM: TierFormState = {
  label: '',
  points: '0',
  evaluatorType: 'numeric_range',
  targetField: '',
  aiQuestionKey: '',
  min: '',
  max: '',
  minExclusive: false,
  maxExclusive: false,
  values: '',
  days: '14',
  aiValue: '',
};

function tierToFormState(tier: ScoringCriteriaTier): TierFormState {
  const config = tier.config ?? {};
  return {
    label: tier.label,
    points: String(tier.points),
    evaluatorType: tier.evaluatorType,
    targetField: tier.targetField ?? '',
    aiQuestionKey: tier.aiQuestionKey ?? '',
    min: config.min !== undefined ? String(config.min) : '',
    max: config.max !== undefined ? String(config.max) : '',
    minExclusive: Boolean(config.minExclusive),
    maxExclusive: Boolean(config.maxExclusive),
    values: Array.isArray(config.values) ? config.values.join(', ') : '',
    days: config.days !== undefined ? String(config.days) : '14',
    aiValue: config.aiValue !== undefined ? String(config.aiValue) : '',
  };
}

function tierFormToPayload(f: TierFormState) {
  let config: Record<string, unknown> = {};
  if (f.evaluatorType === 'numeric_range') {
    config = {
      ...(f.min ? { min: Number(f.min), minExclusive: f.minExclusive } : {}),
      ...(f.max ? { max: Number(f.max), maxExclusive: f.maxExclusive } : {}),
    };
  } else if (f.evaluatorType === 'list_match') {
    config = { values: f.values.split(',').map((v) => v.trim()).filter(Boolean) };
  } else if (f.evaluatorType === 'date_diff_gte') {
    config = { days: Number(f.days) || 14 };
  } else if (f.evaluatorType === 'ai_classification') {
    config = { aiValue: f.aiValue === 'true' ? true : f.aiValue === 'false' ? false : f.aiValue };
  }

  return {
    label: f.label,
    points: Number(f.points) || 0,
    evaluatorType: f.evaluatorType,
    targetField:
      f.evaluatorType === 'numeric_range' || f.evaluatorType === 'list_match' ? f.targetField : undefined,
    aiQuestionKey: f.evaluatorType === 'ai_classification' ? f.aiQuestionKey : undefined,
    config,
  };
}

interface GroupFormState {
  name: string;
  description: string;
  aggregation: ScoringAggregation;
  bonusPoints: string;
}

const EMPTY_GROUP_FORM: GroupFormState = {
  name: '',
  description: '',
  aggregation: 'best_tier',
  bonusPoints: '10',
};

function groupToFormState(g: ScoringCriteriaGroup): GroupFormState {
  return {
    name: g.name,
    description: g.description ?? '',
    aggregation: g.aggregation,
    bonusPoints: g.bonusPoints != null ? String(g.bonusPoints) : '10',
  };
}

export function ScoringCriteriaPage() {
  const queryClient = useQueryClient();
  const [groupDialogMode, setGroupDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(EMPTY_GROUP_FORM);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  const [tierDialogMode, setTierDialogMode] = useState<'create' | 'edit' | null>(null);
  const [tierGroupId, setTierGroupId] = useState<string | null>(null);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<TierFormState>(EMPTY_TIER_FORM);
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['scoring-criteria', 'groups'],
    queryFn: async () => (await apiClient.get<ScoringCriteriaGroup[]>('/scoring-criteria/groups')).data,
  });

  const { data: fieldMetadata } = useQuery({
    queryKey: ['scoring-criteria', 'fields'],
    queryFn: async () => (await apiClient.get<ScoringFieldMetadata>('/scoring-criteria/fields')).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['scoring-criteria'] });

  const createGroupMutation = useMutation({
    mutationFn: async () => apiClient.post('/scoring-criteria/groups', groupPayload(groupForm)),
    onSuccess: () => {
      setGroupDialogMode(null);
      invalidate();
    },
  });
  const updateGroupMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/scoring-criteria/groups/${editingGroupId}`, groupPayload(groupForm)),
    onSuccess: () => {
      setGroupDialogMode(null);
      setEditingGroupId(null);
      invalidate();
    },
  });
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/scoring-criteria/groups/${id}`),
    onSuccess: () => {
      setDeleteGroupId(null);
      invalidate();
    },
  });
  const toggleGroupActiveMutation = useMutation({
    mutationFn: async (payload: { id: string; isActive: boolean }) =>
      apiClient.patch(`/scoring-criteria/groups/${payload.id}`, { isActive: payload.isActive }),
    onSuccess: invalidate,
  });
  const moveGroupMutation = useMutation({
    mutationFn: async (payload: { id: string; direction: 'up' | 'down' }) =>
      apiClient.post(`/scoring-criteria/groups/${payload.id}/move`, { direction: payload.direction }),
    onSuccess: invalidate,
  });

  const createTierMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/scoring-criteria/groups/${tierGroupId}/tiers`, tierFormToPayload(tierForm)),
    onSuccess: () => {
      setTierDialogMode(null);
      invalidate();
    },
  });
  const updateTierMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/scoring-criteria/tiers/${editingTierId}`, tierFormToPayload(tierForm)),
    onSuccess: () => {
      setTierDialogMode(null);
      setEditingTierId(null);
      invalidate();
    },
  });
  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/scoring-criteria/tiers/${id}`),
    onSuccess: () => {
      setDeleteTierId(null);
      invalidate();
    },
  });
  const moveTierMutation = useMutation({
    mutationFn: async (payload: { id: string; direction: 'up' | 'down' }) =>
      apiClient.post(`/scoring-criteria/tiers/${payload.id}/move`, { direction: payload.direction }),
    onSuccess: invalidate,
  });

  function groupPayload(f: GroupFormState) {
    return {
      name: f.name,
      description: f.description.trim() || undefined,
      aggregation: f.aggregation,
      bonusPoints: f.aggregation === 'flat_if_any' ? Number(f.bonusPoints) || 0 : undefined,
    };
  }

  function openCreateGroup() {
    setGroupForm(EMPTY_GROUP_FORM);
    setEditingGroupId(null);
    setGroupDialogMode('create');
  }
  function openEditGroup(g: ScoringCriteriaGroup) {
    setGroupForm(groupToFormState(g));
    setEditingGroupId(g.id);
    setGroupDialogMode('edit');
  }
  function handleGroupSubmit(e: FormEvent) {
    e.preventDefault();
    if (groupDialogMode === 'edit') updateGroupMutation.mutate();
    else createGroupMutation.mutate();
  }

  function openCreateTier(groupId: string) {
    setTierForm(EMPTY_TIER_FORM);
    setTierGroupId(groupId);
    setEditingTierId(null);
    setTierDialogMode('create');
  }
  function openEditTier(tier: ScoringCriteriaTier) {
    setTierForm(tierToFormState(tier));
    setTierGroupId(tier.groupId);
    setEditingTierId(tier.id);
    setTierDialogMode('edit');
  }
  function handleTierSubmit(e: FormEvent) {
    e.preventDefault();
    if (tierDialogMode === 'edit') updateTierMutation.mutate();
    else createTierMutation.mutate();
  }

  const isSavingGroup = createGroupMutation.isPending || updateGroupMutation.isPending;
  const isSavingTier = createTierMutation.isPending || updateTierMutation.isPending;

  const selectedAiQuestion = fieldMetadata?.aiQuestionKeys.find((q) => q.value === tierForm.aiQuestionKey);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Cấu hình chấm điểm</h1>
        <p className="text-sm text-muted-foreground">
          Các nhóm tiêu chí dùng để tính điểm theo tiêu chí khách hàng (song song với điểm AI). Nhóm{' '}
          <Sparkles className="inline h-3.5 w-3.5 -mt-0.5" /> cần AI phán đoán — chỉ sửa được điểm/mô tả, số
          mức bị giới hạn theo câu hỏi AI cố định. Nhóm <Calculator className="inline h-3.5 w-3.5 -mt-0.5" />{' '}
          tính hoàn toàn tự động — tự do thêm/sửa/xoá mức.
        </p>
      </div>

      <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs" onClick={openCreateGroup}>
        <Plus className="h-4 w-4" />
        Thêm nhóm
      </Button>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <div className="space-y-4">
          {groups?.map((group, idx) => {
            const isAiGroup = group.tiers.some((t) => t.evaluatorType === 'ai_classification');
            return (
              <Card key={group.id} className={cn('transition-colors', !group.isActive && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isAiGroup ? (
                        <Sparkles className="h-4 w-4 text-violet-500 shrink-0" />
                      ) : (
                        <Calculator className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div>
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {AGGREGATION_LABELS[group.aggregation]}
                          </Badge>
                          {group.aggregation === 'flat_if_any' && (
                            <Badge variant="secondary" className="text-xs">
                              +{group.bonusPoints}đ nếu đạt
                            </Badge>
                          )}
                          {!group.isActive && (
                            <Badge variant="pending" className="text-xs">
                              Đã tắt
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={idx === 0 || moveGroupMutation.isPending}
                        onClick={() => moveGroupMutation.mutate({ id: group.id, direction: 'up' })}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={idx === (groups?.length ?? 0) - 1 || moveGroupMutation.isPending}
                        onClick={() => moveGroupMutation.mutate({ id: group.id, direction: 'down' })}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          toggleGroupActiveMutation.mutate({ id: group.id, isActive: !group.isActive })
                        }
                      >
                        {group.isActive ? 'Tắt' : 'Bật'}
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openEditGroup(group)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="destructive" size="xs" onClick={() => setDeleteGroupId(group.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {group.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.tiers.map((tier, tIdx) => (
                    <div
                      key={tier.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{tier.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {tier.points}đ
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {EVALUATOR_LABELS[tier.evaluatorType]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{summarizeTierConfig(tier)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={tIdx === 0 || moveTierMutation.isPending}
                          onClick={() => moveTierMutation.mutate({ id: tier.id, direction: 'up' })}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={tIdx === group.tiers.length - 1 || moveTierMutation.isPending}
                          onClick={() => moveTierMutation.mutate({ id: tier.id, direction: 'down' })}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="xs" onClick={() => openEditTier(tier)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="destructive" size="xs" onClick={() => setDeleteTierId(tier.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {group.tiers.length === 0 && (
                    <p className="text-sm text-muted-foreground">Chưa có mức nào.</p>
                  )}
                  <Button variant="outline" size="xs" className="gap-1.5" onClick={() => openCreateTier(group.id)}>
                    <Plus className="h-3.5 w-3.5" />
                    Thêm mức
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {groups?.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
              Chưa có nhóm tiêu chí nào.
            </div>
          )}
        </div>
      )}

      {/* Group create/edit dialog */}
      <Dialog open={groupDialogMode !== null} onOpenChange={(open) => !open && setGroupDialogMode(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{groupDialogMode === 'edit' ? 'Sửa nhóm tiêu chí' : 'Thêm nhóm tiêu chí'}</DialogTitle>
            <DialogDescription>
              Nhóm gồm nhiều mức điểm — hệ thống tự động chọn mức khớp (hoặc cộng điểm cố định nếu đạt bất
              kỳ mức nào, tuỳ cách tính).
            </DialogDescription>
          </DialogHeader>
          <form id="group-form" onSubmit={handleGroupSubmit} className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Tên nhóm</label>
              <Input
                placeholder="Ví dụ: Dự toán"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Mô tả <span className="text-xs text-muted-foreground">(dùng làm ngữ cảnh cho AI nếu nhóm có mức AI phân loại)</span>
              </label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Cách tính điểm</label>
                <Select
                  value={groupForm.aggregation}
                  onValueChange={(val) => setGroupForm({ ...groupForm, aggregation: val as ScoringAggregation })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best_tier">Chọn mức khớp cao nhất</SelectItem>
                    <SelectItem value="flat_if_any">Đạt 1 trong các mức → cộng cố định</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {groupForm.aggregation === 'flat_if_any' && (
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Điểm cộng cố định</label>
                  <Input
                    type="number"
                    value={groupForm.bonusPoints}
                    onChange={(e) => setGroupForm({ ...groupForm, bonusPoints: e.target.value })}
                  />
                </div>
              )}
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGroupDialogMode(null)}>
              Hủy
            </Button>
            <Button type="submit" form="group-form" disabled={isSavingGroup}>
              {isSavingGroup ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu nhóm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier create/edit dialog */}
      <Dialog open={tierDialogMode !== null} onOpenChange={(open) => !open && setTierDialogMode(null)}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tierDialogMode === 'edit' ? 'Sửa mức điểm' : 'Thêm mức điểm'}</DialogTitle>
          </DialogHeader>
          <form id="tier-form" onSubmit={handleTierSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Nhãn hiển thị</label>
                <Input
                  placeholder="Ví dụ: 300 triệu - 2 tỷ"
                  value={tierForm.label}
                  onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Điểm</label>
                <Input
                  type="number"
                  value={tierForm.points}
                  onChange={(e) => setTierForm({ ...tierForm, points: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Kiểu điều kiện</label>
              <Select
                value={tierForm.evaluatorType}
                onValueChange={(val) => setTierForm({ ...tierForm, evaluatorType: val as ScoringEvaluatorType })}
                disabled={tierDialogMode === 'edit'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric_range">Khoảng số (vd dự toán)</SelectItem>
                  <SelectItem value="list_match">Danh sách chứa (vd tỉnh, từ khoá)</SelectItem>
                  <SelectItem value="date_diff_gte">Chênh lệch ngày ≥ N</SelectItem>
                  <SelectItem value="ai_classification">AI phân loại</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(tierForm.evaluatorType === 'numeric_range' || tierForm.evaluatorType === 'list_match') && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Trường dữ liệu áp dụng</label>
                <Select
                  value={tierForm.targetField}
                  onValueChange={(val) => setTierForm({ ...tierForm, targetField: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn trường" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldMetadata?.targetFields.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {tierForm.evaluatorType === 'numeric_range' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Từ (min, để trống = không giới hạn)</label>
                  <Input
                    type="number"
                    value={tierForm.min}
                    onChange={(e) => setTierForm({ ...tierForm, min: e.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={tierForm.minExclusive}
                      onChange={(e) => setTierForm({ ...tierForm, minExclusive: e.target.checked })}
                    />
                    Không tính giá trị bằng min (&gt; thay vì ≥)
                  </label>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Đến (max, để trống = không giới hạn)</label>
                  <Input
                    type="number"
                    value={tierForm.max}
                    onChange={(e) => setTierForm({ ...tierForm, max: e.target.value })}
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={tierForm.maxExclusive}
                      onChange={(e) => setTierForm({ ...tierForm, maxExclusive: e.target.checked })}
                    />
                    Không tính giá trị bằng max (&lt; thay vì ≤)
                  </label>
                </div>
              </div>
            )}

            {tierForm.evaluatorType === 'list_match' && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Danh sách giá trị <span className="text-xs text-muted-foreground">(cách nhau bằng dấu phẩy, để trống = mức mặc định/luôn khớp)</span>
                </label>
                <Textarea
                  placeholder="Đà Nẵng, Hà Nội"
                  value={tierForm.values}
                  onChange={(e) => setTierForm({ ...tierForm, values: e.target.value })}
                />
              </div>
            )}

            {tierForm.evaluatorType === 'date_diff_gte' && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Số ngày tối thiểu (đăng~kết thúc)</label>
                <Input
                  type="number"
                  value={tierForm.days}
                  onChange={(e) => setTierForm({ ...tierForm, days: e.target.value })}
                />
              </div>
            )}

            {tierForm.evaluatorType === 'ai_classification' && (
              <>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Câu hỏi AI</label>
                  <Select
                    value={tierForm.aiQuestionKey}
                    onValueChange={(val) => setTierForm({ ...tierForm, aiQuestionKey: val, aiValue: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn câu hỏi" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldMetadata?.aiQuestionKeys.map((q) => (
                        <SelectItem key={q.value} value={q.value}>
                          {q.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedAiQuestion?.valueType === 'boolean' && (
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Giá trị khớp</label>
                    <Select value={tierForm.aiValue} onValueChange={(val) => setTierForm({ ...tierForm, aiValue: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Đúng</SelectItem>
                        <SelectItem value="false">Sai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedAiQuestion?.valueType === 'enum' && (
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Giá trị khớp</label>
                    <Select value={tierForm.aiValue} onValueChange={(val) => setTierForm({ ...tierForm, aiValue: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedAiQuestion.enumValues?.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTierDialogMode(null)}>
              Hủy
            </Button>
            <Button type="submit" form="tier-form" disabled={isSavingTier}>
              {isSavingTier ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                'Lưu mức'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteGroupId)}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
        title="Xác nhận xóa nhóm tiêu chí"
        description="Xóa nhóm sẽ xóa toàn bộ các mức điểm bên trong. Các điểm đã chấm trước đó không bị ảnh hưởng."
        onConfirm={() => deleteGroupId && deleteGroupMutation.mutate(deleteGroupId)}
        isPending={deleteGroupMutation.isPending}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTierId)}
        onOpenChange={(open) => !open && setDeleteTierId(null)}
        title="Xác nhận xóa mức điểm"
        description="Bạn có chắc chắn muốn xóa mức điểm này không?"
        onConfirm={() => deleteTierId && deleteTierMutation.mutate(deleteTierId)}
        isPending={deleteTierMutation.isPending}
      />
    </div>
  );
}
