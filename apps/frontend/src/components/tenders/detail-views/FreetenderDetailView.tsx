import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  FileText,
  ExternalLink,
  ShieldCheck,
  Layers,
  Hash,
  Briefcase,
} from 'lucide-react';
import { FreetenderStructuredPayload, TenderDetailViewProps } from './types';

interface FreetenderDetailViewProps extends TenderDetailViewProps {
  payload?: FreetenderStructuredPayload | null;
}

function tryParseFreetenderPayload(description: string | null): FreetenderStructuredPayload | null {
  if (!description?.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(description);
    if (parsed._format === 'freetender_v1') return parsed as FreetenderStructuredPayload;
  } catch {
    // ignore parse error, fallback
  }
  return null;
}

/**
 * Formats raw procurement text by breaking at clause markers ((i), (ii)),
 * circled numbers (⑴, ⑵), bullets (•), and section headers.
 */
function formatProcurementText(text: string | null | undefined): string {
  if (!text) return '';
  let s = text.trim();

  // 1. Break before parenthesized roman numerals or letters/numbers followed by a capital letter: (i) Description, (ii) Solicitation...
  s = s.replace(
    /\s*(\((?:x{1,2}[ivx]*|v?i{1,4}|iv|v|ix|[a-z]|\d{1,2})\))\s*(?=[A-Z])/gi,
    '\n\n '
  );

  // 2. Break before circled numbers: ⑴, ⑵, ⑶, ..., ⑽, ①, ②, etc.
  s = s.replace(/\s*([⑴-⒇①-⑳])\s*/g, '\n\n ');

  // 3. Break before bullet points: •, ⁃, ◦, ▪
  s = s.replace(/\s*([•⁃◦▪])\s*/g, '\n• ');

  // 4. Break before exact uppercase headers
  s = s.replace(/\s*\b(COMBINED SYNOPSIS\/SOLICITATION)\b\s*/g, '\n\n\n');

  // 5. Break before common solicitation subheadings after a sentence end
  const subheadings = [
    'Objective\\.',
    'Minimum Performance Requirements\\.',
    'Implementation\\.',
    'Summary of notice\\b',
    'Summay of notice\\b',
    'Qualifications for participating\\b',
  ];
  for (const sh of subheadings) {
    s = s.replace(new RegExp('(?<=[.!?])\\s+(' + sh + ')\\s*', 'g'), '\n\n\n');
  }

  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Renders structured paragraph blocks with styling for clauses and bullet items.
 */
function StructuredTextRenderer({ content }: { content: string }) {
  const formatted = formatProcurementText(content);
  const blocks = formatted.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-3.5 text-sm text-foreground/90 leading-relaxed">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();

        // Check if block contains bullet items
        if (trimmed.includes('\n• ') || trimmed.startsWith('• ')) {
          const lines = trimmed.split('\n').filter(Boolean);
          const header = lines[0].startsWith('• ') ? null : lines[0];
          const bulletLines = lines.filter((l) => l.trim().startsWith('• '));

          return (
            <div key={idx} className="space-y-2">
              {header && <p className="font-medium text-foreground">{header}</p>}
              <ul className="space-y-1.5 pl-4">
                {bulletLines.map((bullet, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2 text-foreground/90">
                    <span className="text-primary font-bold mt-1 text-xs">•</span>
                    <span className="flex-1">{bullet.replace(/^•\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        // Section headers or prominent clauses: (i), ⑴, COMBINED SYNOPSIS...
        const isHeader =
          trimmed.startsWith('COMBINED SYNOPSIS') ||
          trimmed.startsWith('Objective.') ||
          trimmed.startsWith('Minimum Performance Requirements.') ||
          trimmed.startsWith('Implementation.');

        if (isHeader) {
          return (
            <h4
              key={idx}
              className="font-bold text-foreground text-sm uppercase tracking-wide pt-2 border-t border-border/40"
            >
              {trimmed}
            </h4>
          );
        }

        // Clause numbered paragraphs like (i) Description..., ⑴ Official...
        const isClause = /^(\((?:[ivxlcdm]+|\d{1,2}|[a-z])\)|[⑴-⒇①-⑳])\s+/i.test(trimmed);
        if (isClause) {
          const match = trimmed.match(/^(\((?:[ivxlcdm]+|\d{1,2}|[a-z])\)|[⑴-⒇①-⑳])\s+(.+)$/s);
          if (match) {
            const [, marker, rest] = match;
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-semibold shrink-0 bg-muted/50 text-foreground border-border/60 mt-0.5"
                >
                  {marker}
                </Badge>
                <p className="flex-1 text-foreground/90 leading-relaxed">{rest}</p>
              </div>
            );
          }
        }

        return (
          <p key={idx} className="text-foreground/90 leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function FreetenderDetailView({
  description,
  requirementsText,
  payload: propPayload,
}: FreetenderDetailViewProps) {
  const payload = propPayload || tryParseFreetenderPayload(description);

  if (!payload) {
    const rawContent = description || requirementsText || 'Không có mô tả.';
    return (
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Nội dung chi tiết
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <StructuredTextRenderer content={rawContent} />
        </CardContent>
      </Card>
    );
  }

  const { summary, full_details, meta = {}, official_url, freetender_url } = payload;
  const detailedRequirements = full_details || requirementsText;

  return (
    <div className="space-y-6">
      {/* KHỐI 1: CỔNG ĐẤU THẦU & LIÊN KẾT CHÍNH THỨC */}
      {(official_url || freetender_url) && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Cổng thông tin & Xác thực hồ sơ gốc
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                {meta.source_portal && (
                  <Badge variant="outline" className="text-xs font-medium border-border/60">
                    <Globe className="h-3 w-3 mr-1 text-muted-foreground" />
                    {meta.source_portal}
                  </Badge>
                )}
                {meta.reference && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    <Hash className="h-3 w-3 mr-0.5 opacity-70" />
                    Ref: {meta.reference}
                  </Badge>
                )}
                {meta.type && (
                  <Badge variant="outline" className="text-xs capitalize">
                    <Briefcase className="h-3 w-3 mr-1 text-muted-foreground" />
                    {meta.type}
                  </Badge>
                )}
                {meta.naics && (
                  <Badge variant="outline" className="font-mono text-xs">
                    NAICS: {meta.naics}
                  </Badge>
                )}
                {meta.psc && (
                  <Badge variant="outline" className="font-mono text-xs">
                    PSC: {meta.psc}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex flex-wrap items-center gap-3">
            {official_url && (
              <Button asChild variant="default" size="sm" className="font-semibold shadow-sm">
                <a
                  href={official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Xem & Ứng tuyển trên Cổng chính thức
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
            )}

            {freetender_url && (
              <Button asChild variant="outline" size="sm" className="border-border/70 hover:bg-muted/60">
                <a
                  href={freetender_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Hồ sơ lưu trữ (FreeTender)
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* KHỐI 2: TÓM TẮT GÓI THẦU (EXECUTIVE SUMMARY) */}
      {summary && (
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Tóm tắt thông báo (Executive Summary)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <StructuredTextRenderer content={summary} />
          </CardContent>
        </Card>
      )}

      {/* KHỐI 3: PHẠM VI CÔNG VIỆC & YÊU CẦU CHI TIẾT (STATEMENT OF WORK & SPECIFICATIONS) */}
      {detailedRequirements && (
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              Phạm vi công việc & Yêu cầu kỹ thuật (Statement of Work & Specifications)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="max-h-[650px] overflow-y-auto pr-2 rounded-md p-4 sm:p-5 bg-muted/20 border border-border/40">
              <StructuredTextRenderer content={detailedRequirements} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
