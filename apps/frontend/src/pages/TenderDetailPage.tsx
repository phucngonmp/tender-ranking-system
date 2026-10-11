import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { useAuth } from '../auth/AuthContext';
import { TenderDetail, TenderAttachment } from '../types';
import { formatCurrency, formatDateTimeShort, getSingaporeEstimatedPriceInfo, VERDICT_BADGE_CLASS, VERDICT_LABELS } from '../utils/format';
import mammoth from 'mammoth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Eye, Download, X, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TenderDescriptionView } from '@/components/tenders/TenderDescriptionView';

const VERDICT_VARIANT: Record<string, 'success' | 'warning' | 'destructive' | 'pending'> = {
  high: 'success',
  medium: 'warning',
  low: 'destructive',
  pending: 'pending',
};

export function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [previewFile, setPreviewFile] = useState<TenderAttachment | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: tender, isLoading } = useQuery({
    queryKey: ['tender', id],
    queryFn: async () => {
      const response = await apiClient.get<TenderDetail>(`/tenders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const rescoreMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/tenders/${id}/rescore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tender', id] });
    },
  });

  const rescoreRubricMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/tenders/${id}/rescore-rubric`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tender', id] });
    },
  });

  useEffect(() => {
    if (!previewFile) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setDocxHtml(null);
      return;
    }

    let isMounted = true;
    setPreviewLoading(true);
    const token = tokenStore.getAccessToken();
    const url = `/api/tenders/${tender?.id}/attachments/${previewFile.id}/download?inline=true`;

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
      })
      .then(async blob => {
        if (!isMounted) return;
        const ext = previewFile.fileName.split('.').pop()?.toLowerCase();
        if (ext === 'docx' || ext === 'doc') {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (isMounted) setDocxHtml(result.value);
        } else {
          const blobUrl = URL.createObjectURL(blob);
          if (isMounted) setPreviewBlobUrl(blobUrl);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        alert('Không thể xem trước file: ' + err);
        setPreviewFile(null);
      })
      .finally(() => {
        if (isMounted) setPreviewLoading(false);
      });

    return () => { isMounted = false; };
  }, [previewFile, tender?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải...
      </div>
    );
  }
  if (!tender) {
    return (
      <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Không tìm thấy gói thầu.
      </div>
    );
  }

  const latestScore = tender.scores[0];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/tenders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách
      </Link>

      <h1 className="text-2xl font-bold text-foreground leading-snug">{tender.title}</h1>

      {/* Detail Grid */}
      <Card>
        <CardContent className="pt-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Chủ đầu tư', value: tender.investor ?? '-' },
              { label: 'Lĩnh vực', value: tender.sector ?? '-' },
              { label: 'Địa phương', value: tender.locality ?? '-' },
              {
                label: 'Giá trị gói thầu',
                value: (() => {
                  const sgInfo = getSingaporeEstimatedPriceInfo(
                    tender.estimatedValue,
                    tender.currency,
                    `${tender.description ?? ''} ${tender.requirementsText ?? ''}`,
                    tender.externalCode
                  );
                  if (sgInfo) {
                    return (
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            {sgInfo.displayRange}
                          </span>
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            title={sgInfo.ceilingText}
                          >
                            Ước lượng{sgInfo.gradeCode ? ` (${sgInfo.gradeCode})` : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">
                          {sgInfo.ceilingText}
                        </p>
                      </div>
                    );
                  }
                  return tender.estimatedValue ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-foreground">
                        {formatCurrency(tender.estimatedValue, tender.currency ?? 'VND')}
                      </span>
                      {tender.currency === 'SGD' && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          Ước lượng
                        </span>
                      )}
                    </span>
                  ) : (
                    '-'
                  );
                })(),
              },
              { label: 'Ngày mở thầu', value: formatDateTimeShort(tender.submissionOpenDate) },
              { label: 'Hạn nộp', value: formatDateTimeShort(tender.submissionDeadline) },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nguồn</dt>
              <dd className="mt-0.5 text-sm">
                <a
                  href={tender.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline underline-offset-2"
                >
                  {tender.source.name}
                </a>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Description, Contact, Site Briefing & Technical Specs */}
      <TenderDescriptionView
        description={tender.description}
        requirementsText={tender.requirementsText}
        currency={tender.currency}
        sourceType={tender.source?.sourceType}
      />

      {/* Attachments */}
      <Card>
        <CardHeader><CardTitle>Hồ sơ mời thầu (File đính kèm)</CardTitle></CardHeader>
        <CardContent>
          {tender.attachments && tender.attachments.length > 0 ? (
            <ul className="space-y-2">
              {tender.attachments
                .filter(f => f.documentType !== 'WEBFORM')
                .map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{file.fileName}</p>
                      {file.fileSize ? (
                        <p className="text-xs text-muted-foreground">{Math.round(file.fileSize / 1024)} KB</p>
                      ) : (
                        <p className="text-xs text-amber-600">⏳ Đang tải file về máy chủ...</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!file.storagePath}
                        onClick={() => window.open(`/tenders/${tender?.id}/attachments/${file.id}/preview`, '_blank')}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem trước
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!file.storagePath}
                        onClick={async () => {
                          try {
                            const token = tokenStore.getAccessToken();
                            const res = await fetch(`/api/tenders/${tender.id}/attachments/${file.id}/download`, {
                              headers: { 'Authorization': `Bearer ${token}` },
                            });
                            if (!res.ok) throw new Error('HTTP ' + res.status);
                            const blob = await res.blob();
                            const blobUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = file.fileName;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(blobUrl);
                          } catch (err) {
                            alert('Tải file thất bại: ' + err);
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Tải xuống
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Không có file đính kèm hoặc chưa được tải về.</p>
          )}
        </CardContent>
      </Card>

      {/* File Preview Panel */}
      {previewFile && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Đang xem: <span className="text-muted-foreground">{previewFile.fileName}</span>
            </p>
            <Button variant="ghost" size="xs" onClick={() => setPreviewFile(null)}>
              <X className="h-4 w-4" />
              Đóng
            </Button>
          </div>
          <div className="h-[700px] overflow-auto bg-muted/20">
            {previewLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Đang tải nội dung file...
              </div>
            )}
            {!previewLoading && docxHtml && (
              <div
                className="mx-auto max-w-3xl bg-white px-12 py-8 font-serif text-sm leading-relaxed min-h-full"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            )}
            {!previewLoading && previewBlobUrl && (
              <iframe
                src={previewBlobUrl}
                className="block h-full w-full border-0"
                title={previewFile.fileName}
              />
            )}
          </div>
        </Card>
      )}

      {/* AI Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Đánh giá AI</CardTitle>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => rescoreMutation.mutate()}
                disabled={rescoreMutation.isPending}
              >
                {rescoreMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Đang gửi...</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />Chấm điểm lại</>
                )}
              </Button>
            )}
          </div>
          {rescoreMutation.isSuccess && (
            <p className="text-xs text-emerald-600 mt-1">
              Đã đưa vào hàng đợi, điểm mới sẽ cập nhật sau ít phút.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {latestScore ? (
            <div className="space-y-4">
              {/* Score summary */}
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-foreground">{latestScore.finalScore}</span>
                <span className="text-sm text-muted-foreground">
                  (AI: {latestScore.aiScore}, rule: {latestScore.ruleScore >= 0 ? '+' : ''}{latestScore.ruleScore})
                </span>
                <Badge variant={VERDICT_VARIANT[VERDICT_BADGE_CLASS[latestScore.verdict] ?? 'pending'] ?? 'pending'}>
                  {VERDICT_LABELS[latestScore.verdict] ?? latestScore.verdict}
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-foreground">Lý do:</span>{' '}<span className="text-muted-foreground">{latestScore.aiRationale}</span></p>
                {latestScore.matchedCriteria.length > 0 && (
                  <p><span className="font-medium text-foreground">Tiêu chí khớp:</span>{' '}<span className="text-muted-foreground">{latestScore.matchedCriteria.join(', ')}</span></p>
                )}
                {latestScore.gaps.length > 0 && (
                  <p><span className="font-medium text-foreground">Khoảng trống năng lực:</span>{' '}<span className="text-muted-foreground">{latestScore.gaps.join(', ')}</span></p>
                )}
                {latestScore.riskFlags.length > 0 && (
                  <p><span className="font-medium text-foreground">Cờ rủi ro:</span>{' '}<span className="text-muted-foreground">{latestScore.riskFlags.join(', ')}</span></p>
                )}
                {latestScore.recommendedFocus.length > 0 && (
                  <p><span className="font-medium text-foreground">Gợi ý nhấn mạnh khi dự thầu:</span>{' '}<span className="text-muted-foreground">{latestScore.recommendedFocus.join(', ')}</span></p>
                )}
              </div>

              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                Chấm điểm lúc {new Date(latestScore.scoredAt).toLocaleString('vi-VN')} — {latestScore.modelUsed}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Gói thầu chưa được chấm điểm.</p>
          )}
        </CardContent>
      </Card>

      {/* Rubric Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Điểm theo tiêu chí khách hàng</CardTitle>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => rescoreRubricMutation.mutate()}
                disabled={rescoreRubricMutation.isPending || latestScore?.rubricScore == null}
                title={
                  latestScore?.rubricScore == null
                    ? 'Cần bấm "Chấm điểm lại" (AI) ít nhất 1 lần trước khi có thể chấm lại riêng phần tiêu chí'
                    : undefined
                }
              >
                {rescoreRubricMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Đang chấm lại...</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />Chấm lại theo tiêu chí</>
                )}
              </Button>
            )}
          </div>
          {rescoreRubricMutation.isSuccess && (
            <p className="text-xs text-emerald-600 mt-1">Đã cập nhật điểm theo tiêu chí.</p>
          )}
          {rescoreRubricMutation.isError && (
            <p className="text-xs text-destructive mt-1">
              {(rescoreRubricMutation.error as any)?.response?.data?.message ?? 'Chấm lại thất bại.'}
            </p>
          )}
          {latestScore && latestScore.rubricScore == null && (
            <p className="text-xs text-muted-foreground mt-1">
              Gói thầu này được chấm điểm AI trước khi có tính năng điểm theo tiêu chí — bấm "Chấm điểm lại" ở
              trên để có điểm theo tiêu chí lần đầu.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {latestScore?.rubricScore != null && latestScore.rubricBreakdown ? (
            <div className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-foreground">{latestScore.rubricScore}</span>
                <span className="text-sm text-muted-foreground">/ 120</span>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {latestScore.rubricBreakdown.groups.map((g) => (
                  <div key={g.groupId}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {g.groupName}
                    </dt>
                    <dd className="mt-0.5 text-sm text-foreground">
                      {g.points}đ — {g.label}
                      {g.reasons && g.reasons.length > 0 ? ` (${g.reasons.join(', ')})` : ''}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có điểm theo tiêu chí.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
