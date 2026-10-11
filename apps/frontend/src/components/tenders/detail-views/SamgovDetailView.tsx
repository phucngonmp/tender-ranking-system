import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import { SamgovStructuredPayload, TenderDetailViewProps } from './types';

interface SamgovDetailViewProps extends TenderDetailViewProps {
  payload?: SamgovStructuredPayload | null;
}

function tryParseSamgovPayload(description: string | null): SamgovStructuredPayload | null {
  if (!description?.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(description);
    if (parsed._format === 'samgov_v1') return parsed as SamgovStructuredPayload;
  } catch {
    // fallback
  }
  return null;
}

/**
 * Cleanly formats US Federal contracting solicitation text.
 */
function formatFederalScopeText(text: string | null | undefined): string {
  if (!text) return '';
  let s = text.trim();

  // Break before parenthesized roman numerals or letters/numbers followed by a capital letter
  s = s.replace(
    /\s*(\((?:x{1,2}[ivx]*|v?i{1,4}|iv|v|ix|[a-z]|\d{1,2})\))\s*(?=[A-Z])/gi,
    '\n\n '
  );

  // Break before bullet points
  s = s.replace(/\s*([•▪▫●])\s*/g, '\n  ');

  // Break before major section titles
  const federalHeadings = [
    'COMBINED SYNOPSIS/SOLICITATION',
    'STATEMENT OF WORK',
    'STATEMENT OF OBJECTIVES',
    'SCOPE OF WORK',
    'BACKGROUND',
    'OBJECTIVE',
    'TECHNICAL REQUIREMENTS',
    'INSTRUCTIONS TO OFFERORS',
    'EVALUATION FACTORS FOR AWARD',
    'PERFORMANCE WORK STATEMENT',
  ];
  for (const fh of federalHeadings) {
    s = s.replace(new RegExp('\\s*\\b(' + fh + ')\\b\\s*', 'g'), '\n\n\n');
  }

  return s.replace(/\n{3,}/g, '\n\n').trim();
}

function StructuredTextRenderer({ content }: { content: string }) {
  const formatted = formatFederalScopeText(content);
  const blocks = formatted.split(/\n\n+/).filter(Boolean);

  return (
    <div className="space-y-3.5 text-sm text-foreground/90 leading-relaxed">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();

        // Bullet points
        if (trimmed.includes('\n  ') || trimmed.startsWith('  ')) {
          const lines = trimmed.split('\n').filter(Boolean);
          const header = lines[0].startsWith('  ') ? null : lines[0];
          const bulletLines = lines.filter((l) => l.trim().startsWith('  '));

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

        // Section headers
        const isHeader =
          trimmed.startsWith('COMBINED SYNOPSIS') ||
          trimmed.startsWith('STATEMENT OF WORK') ||
          trimmed.startsWith('STATEMENT OF OBJECTIVES') ||
          trimmed.startsWith('SCOPE OF WORK') ||
          trimmed.startsWith('TECHNICAL REQUIREMENTS') ||
          trimmed.startsWith('INSTRUCTIONS TO OFFERORS') ||
          trimmed.startsWith('EVALUATION FACTORS') ||
          trimmed.startsWith('PERFORMANCE WORK STATEMENT');

        if (isHeader) {
          return (
            <h4
              key={idx}
              className="font-bold text-foreground text-sm uppercase tracking-wide pt-3 border-t border-border/40"
            >
              {trimmed}
            </h4>
          );
        }

        // Numbered or lettered clauses: (i), (a), 1.
        const isClause = /^(\((?:[ivxlcdm]+|\d{1,2}|[a-z])\))\s+/i.test(trimmed);
        if (isClause) {
          const match = trimmed.match(/^(\((?:[ivxlcdm]+|\d{1,2}|[a-z])\))\s+(.+)$/s);
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

export function SamgovDetailView(props: SamgovDetailViewProps) {
  const { description, requirementsText } = props;
  const payload = props.payload ?? tryParseSamgovPayload(description);

  const content =
    payload?.full_details ||
    payload?.summary ||
    requirementsText ||
    description ||
    'Không có mô tả chi tiết.';

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/20 pb-3 pt-3.5 border-b border-border/40">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          <span>Phạm vi công việc & Yêu cầu kỹ thuật (Statement of Work)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-5">
        <StructuredTextRenderer content={content} />
      </CardContent>
    </Card>
  );
}
