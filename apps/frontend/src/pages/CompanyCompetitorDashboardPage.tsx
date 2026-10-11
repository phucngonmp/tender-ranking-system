import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { apiClient } from '../api/client';
import {
  ClosedTenderCompanyProfile,
  ClosedTenderCompanyTender,
  DataFreshness,
  CompetitorAssessment,
  CompetitorThreatLevel,
} from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatTile } from '@/components/ui-custom/stat-tile';
import { HBarChart } from '@/components/ui-custom/h-bar-chart';
import { VBarChart } from '@/components/ui-custom/v-bar-chart';
import { DataFreshnessNote } from '@/components/ui-custom/data-freshness-note';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileStack,
  Loader2,
  Percent,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trophy,
} from 'lucide-react';

const THREAT_LEVEL_LABELS: Record<CompetitorThreatLevel, string> = {
  low: 'Đe doạ thấp',
  medium: 'Đe doạ trung bình',
  high: 'Đe doạ cao',
};

const THREAT_LEVEL_BADGE: Record<CompetitorThreatLevel, 'success' | 'warning' | 'destructive'> = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
};

const VALUE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '< 500 triệu', min: 0, max: 500_000_000 },
  { label: '500tr - 2 tỷ', min: 500_000_000, max: 2_000_000_000 },
  { label: '2 - 10 tỷ', min: 2_000_000_000, max: 10_000_000_000 },
  { label: '> 10 tỷ', min: 10_000_000_000, max: Infinity },
];

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

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

function quarterLabel(dateStr: string | null): { label: string; sortKey: number } | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return { label: `Q${q}/${d.getFullYear()}`, sortKey: d.getFullYear() * 10 + q };
}

export function CompanyCompetitorDashboardPage() {
  const { companyKey: rawKey } = useParams<{ companyKey: string }>();
  const companyKey = rawKey ? decodeURIComponent(rawKey) : '';
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: freshness } = useQuery({
    queryKey: ['closed-tender-stats-data-freshness'],
    queryFn: async () =>
      (await apiClient.get<DataFreshness>('/closed-tender-stats/data-freshness')).data,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['closed-tender-company-profile', companyKey],
    queryFn: async () =>
      (
        await apiClient.get<ClosedTenderCompanyProfile>('/closed-tender-stats/company-profile', {
          params: { company_key: companyKey },
        })
      ).data,
    enabled: Boolean(companyKey),
  });

  const { data: tenders, isLoading: tendersLoading } = useQuery({
    queryKey: ['closed-tender-company-tenders', companyKey],
    queryFn: async () =>
      (
        await apiClient.get<ClosedTenderCompanyTender[]>('/closed-tender-stats/company-tenders', {
          params: { company_key: companyKey },
        })
      ).data,
    enabled: Boolean(companyKey),
  });

  const { data: assessment, isLoading: assessmentLoading } = useQuery({
    queryKey: ['competitor-assessment', companyKey],
    queryFn: async () =>
      (
        await apiClient.get<CompetitorAssessment | null>('/closed-tender-stats/competitor-assessment', {
          params: { company_key: companyKey },
        })
      ).data,
    enabled: Boolean(companyKey),
  });

  const assessMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<CompetitorAssessment>('/closed-tender-stats/competitor-assessment', {
          company_key: companyKey,
        })
      ).data,
    onSuccess: (data) => {
      queryClient.setQueryData(['competitor-assessment', companyKey], data);
    },
  });

  const keywordBreakdown = useMemo(() => {
    if (!tenders) return [];
    const map = new Map<string, { keyword: string; count: number; winCount: number }>();
    for (const t of tenders) {
      const entry = map.get(t.keyword) ?? { keyword: t.keyword, count: 0, winCount: 0 };
      entry.count += 1;
      if (t.isWinner) entry.winCount += 1;
      map.set(t.keyword, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [tenders]);

  const timeline = useMemo(() => {
    if (!tenders) return [];
    const map = new Map<string, { period: string; count: number; winCount: number; sortKey: number }>();
    for (const t of tenders) {
      const q = quarterLabel(t.bidCloseDate);
      if (!q) continue;
      const entry = map.get(q.label) ?? { period: q.label, count: 0, winCount: 0, sortKey: q.sortKey };
      entry.count += 1;
      if (t.isWinner) entry.winCount += 1;
      map.set(q.label, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [tenders]);

  const valueDistribution = useMemo(() => {
    if (!tenders) return [];
    const buckets = VALUE_BUCKETS.map((b) => ({ ...b, count: 0 }));
    for (const t of tenders) {
      const raw = t.finalPrice ?? t.bidPrice;
      if (!raw) continue;
      const num = Number(raw);
      if (Number.isNaN(num)) continue;
      const bucket = buckets.find((b) => num >= b.min && num < b.max);
      if (bucket) bucket.count += 1;
    }
    return buckets.filter((b) => b.count > 0);
  }, [tenders]);

  const topInvestors = useMemo(() => {
    if (!tenders) return [];
    const map = new Map<string, { investor: string; count: number; winCount: number }>();
    for (const t of tenders) {
      if (!t.investor) continue;
      const entry = map.get(t.investor) ?? { investor: t.investor, count: 0, winCount: 0 };
      entry.count += 1;
      if (t.isWinner) entry.winCount += 1;
      map.set(t.investor, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [tenders]);

  const maxTimelineCount = Math.max(1, ...timeline.map((t) => t.count));
  const maxValueCount = Math.max(1, ...valueDistribution.map((v) => v.count));
  const maxInvestorCount = Math.max(1, ...topInvestors.map((i) => i.count));
  const maxKeywordCount = Math.max(1, ...keywordBreakdown.map((k) => k.count));

  const visibleTenders = tenders?.slice(0, visibleCount) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/closed-tender-stats"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Báo cáo & Đối thủ cạnh tranh
        </Link>
        <h1 className="text-xl font-bold text-foreground">
          {profileLoading ? 'Đang tải...' : (profile?.orgFullname ?? 'Không tìm thấy công ty')}
        </h1>
        {profile?.taxCode && <p className="text-sm text-muted-foreground">Mã số thuế: {profile.taxCode}</p>}
        <DataFreshnessNote lastCrawledAt={freshness?.lastCrawledAt} label="Dữ liệu KQĐT cập nhật lần cuối lúc" className="mt-1.5" />
      </div>

      {profile && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatTile icon={FileStack} label="Số lần bỏ thầu" value={formatCount(profile.bidCount)} />
            <StatTile icon={Trophy} label="Số lần trúng" value={formatCount(profile.winCount)} />
            <StatTile icon={Percent} label="Tỷ lệ trúng" value={`${profile.winRate}%`} />
            <StatTile
              icon={Building2}
              label="Tổng giá trị trúng"
              value={formatValueTiles(profile.totalWinningValue)}
            />
            <StatTile icon={Sparkles} label="Số từ khoá tham gia" value={formatCount(profile.keywordCount)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Xu hướng tham gia theo thời gian</CardTitle>
                <CardDescription>Số gói thầu tham gia mỗi quý — số dưới nhãn là tỷ lệ trúng.</CardDescription>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu ngày đóng thầu.</p>
                ) : (
                  <VBarChart
                    items={timeline.map((t) => {
                      const rate = Math.round((t.winCount / t.count) * 100);
                      return {
                        label: t.period,
                        value: t.count,
                        sublabel: `${rate}%`,
                        title: `${t.period}: ${t.count} gói, trúng ${t.winCount} (${rate}%)`,
                      };
                    })}
                    max={maxTimelineCount}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Từ khoá tham gia</CardTitle>
                <CardDescription>Số gói thầu theo từng từ khoá công ty này tham gia.</CardDescription>
              </CardHeader>
              <CardContent>
                {keywordBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
                ) : (
                  <HBarChart
                    items={keywordBreakdown.map((k) => ({
                      label: k.keyword,
                      value: k.count,
                      title: `${k.keyword}: ${k.count} gói, trúng ${k.winCount}`,
                    }))}
                    max={maxKeywordCount}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Phân bổ theo quy mô giá trị</CardTitle>
                <CardDescription>Số gói thầu theo khoảng giá trị dự thầu/trúng thầu.</CardDescription>
              </CardHeader>
              <CardContent>
                {valueDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu giá trị.</p>
                ) : (
                  <HBarChart
                    items={valueDistribution.map((v) => ({
                      label: v.label,
                      value: v.count,
                      title: `${v.label}: ${v.count} gói`,
                    }))}
                    max={maxValueCount}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top chủ đầu tư</CardTitle>
                <CardDescription>Các chủ đầu tư công ty này làm việc cùng nhiều nhất.</CardDescription>
              </CardHeader>
              <CardContent>
                {topInvestors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
                ) : (
                  <HBarChart
                    items={topInvestors.map((i) => ({
                      label: i.investor,
                      value: i.count,
                      title: `${i.investor}: ${i.count} gói, trúng ${i.winCount}`,
                    }))}
                    max={maxInvestorCount}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* AI competitor assessment */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Đánh giá đối thủ (AI)</h3>
          </div>
          {assessment && !assessMutation.isPending && (
            <Button variant="outline" size="xs" onClick={() => assessMutation.mutate()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Đánh giá lại
            </Button>
          )}
        </div>

        {assessmentLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : assessMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tìm kiếm thông tin trên web và phân tích... có thể mất 20–60 giây.
          </div>
        ) : assessMutation.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {getErrorMessage(assessMutation.error, 'Đánh giá thất bại, vui lòng thử lại.')}
            </p>
            <Button size="sm" onClick={() => assessMutation.mutate()}>
              Thử lại
            </Button>
          </div>
        ) : assessment ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={THREAT_LEVEL_BADGE[assessment.threatLevel]}>
                <ShieldAlert className="h-3.5 w-3.5" />
                {THREAT_LEVEL_LABELS[assessment.threatLevel]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Đánh giá lúc {new Date(assessment.updatedAt).toLocaleString('vi-VN')}
                {assessment.requestedBy ? ` bởi ${assessment.requestedBy}` : ''}
              </span>
            </div>

            <p className="text-foreground">{assessment.companySummary}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Điểm mạnh</div>
                {assessment.strengths.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 text-foreground">
                    {assessment.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Điểm yếu</div>
                {assessment.weaknesses.length > 0 ? (
                  <ul className="list-disc list-inside space-y-0.5 text-foreground">
                    {assessment.weaknesses.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </div>

            {assessment.overlapWithUs && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Mức độ trùng lặp với công ty chúng ta
                </div>
                <p className="text-foreground">{assessment.overlapWithUs}</p>
              </div>
            )}

            {assessment.recommendations.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Khuyến nghị</div>
                <ul className="list-disc list-inside space-y-0.5 text-foreground">
                  {assessment.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Phân tích chi tiết</div>
              <p className="text-foreground whitespace-pre-line">{assessment.fullAnalysis}</p>
            </div>

            {assessment.sources.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Nguồn tham khảo</div>
                <ul className="space-y-0.5">
                  {assessment.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-2"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Dùng AI tìm kiếm thông tin công ty này trên web và so sánh với hồ sơ năng lực công ty bạn để đánh
              giá mức độ cạnh tranh. Chỉ chạy khi bạn bấm nút, kết quả được lưu lại cho lần xem sau.
            </p>
            <Button size="sm" onClick={() => assessMutation.mutate()}>
              <Sparkles className="h-3.5 w-3.5" />
              Đánh giá đối thủ
            </Button>
          </div>
        )}
      </div>

      {/* Tender history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Lịch sử tham gia đấu thầu</h2>

        {tendersLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải...
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gói thầu</TableHead>
                  <TableHead>Chủ đầu tư</TableHead>
                  <TableHead>Từ khoá</TableHead>
                  <TableHead>Giá dự thầu</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTenders.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="text-sm truncate" title={t.title}>
                        {t.title}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{t.notifyNo}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate" title={t.investor ?? undefined}>
                      {t.investor ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.keyword}</TableCell>
                    <TableCell className="text-sm">{formatCurrency(t.finalPrice ?? t.bidPrice)}</TableCell>
                    <TableCell>
                      {t.isWinner ? (
                        <Badge variant="success">Trúng thầu</Badge>
                      ) : (
                        <Badge variant="outline">Không trúng</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.rankOrReason ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {(!tenders || tenders.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Không có dữ liệu.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {tenders && visibleCount < tenders.length && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                  Xem thêm ({tenders.length - visibleCount} gói còn lại)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
