import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailDigestSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailDigestSettingsService } from './email-digest-settings.service';

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

interface DigestRow {
  id: string;
  title: string;
  investor: string | null;
  locality: string | null;
  estimated_value: string | null;
  currency: string | null;
  submission_deadline: Date | null;
  source_name: string;
  final_score: number | null;
  rubric_score: number | null;
  verdict: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrency(value: string | null, currency: string | null): string {
  if (!value) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${new Intl.NumberFormat('vi-VN').format(num)} ${currency ?? 'VND'}`;
}

/**
 * Daily digest at an admin-configurable time (default 08:00): top-N tenders
 * (N = settings.topCount) first seen in the last 24h, still open for
 * submission, and meeting settings.minScore (combined finalScore /100 +
 * rubricScore /120, null = no threshold) — grouped by crawl source in the
 * email body for easier scanning.
 *
 * The send time is data, not a static cron expression, so this ticks every
 * minute and checks whether "now" matches the configured hour:minute and
 * hasn't already sent today — same pattern as SchedulerService's fixed-hour
 * crawl dispatch.
 */
@Injectable()
export class EmailDigestService {
  private readonly logger = new Logger(EmailDigestService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private settingsService: EmailDigestSettingsService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendScheduledDigest(): Promise<void> {
    const settings = await this.settingsService.get();
    if (!settings.isEnabled) return;

    const now = new Date();
    if (now.getHours() !== settings.sendHour || now.getMinutes() !== settings.sendMinute) return;
    if (settings.lastSentAt && isSameCalendarDay(settings.lastSentAt, now)) return;

    if (settings.recipients.length === 0) {
      this.logger.log('Đến giờ gửi digest nhưng chưa cấu hình người nhận — bỏ qua.');
      return;
    }

    await this.buildAndSend(settings);
    await this.settingsService.markSent();
  }

  async sendNow(): Promise<{ sent: boolean; recipientCount: number; tenderCount: number }> {
    const settings = await this.settingsService.get();
    return this.buildAndSend(settings);
  }

  private async buildAndSend(settings: EmailDigestSetting) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const minScore = settings.minScore ?? 0;

    const rows = await this.prisma.$queryRaw<DigestRow[]>`
      SELECT t.id, t.title, t.investor, t.locality, t.estimated_value, t.currency,
             t.submission_deadline, s.name AS source_name,
             ls.final_score, ls.rubric_score, ls.verdict
      FROM tenders t
      JOIN sources s ON s.id = t.source_id
      LEFT JOIN LATERAL (
        SELECT * FROM tender_scores ts
        WHERE ts.tender_id = t.id
        ORDER BY ts.scored_at DESC
        LIMIT 1
      ) ls ON true
      WHERE t.first_seen_at >= ${since}
        AND t.submission_deadline > NOW()
        AND (COALESCE(ls.final_score, 0) + COALESCE(ls.rubric_score, 0)) >= ${minScore}
      ORDER BY (COALESCE(ls.final_score, 0) + COALESCE(ls.rubric_score, 0)) DESC
      LIMIT ${settings.topCount}
    `;

    const subject = `[Tender Ranking] Top gói thầu mới ngày ${new Date().toLocaleDateString('vi-VN')}`;
    const html = this.buildHtml(rows, settings);
    const sent = await this.emailService.sendMail(settings.recipients, subject, html);

    return { sent, recipientCount: settings.recipients.length, tenderCount: rows.length };
  }

  private buildHtml(rows: DigestRow[], settings: EmailDigestSetting): string {
    const baseUrl = this.configService.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:8080';

    if (rows.length === 0) {
      return '<p style="font-family:sans-serif">Không có gói thầu nào phù hợp bộ lọc trong 24 giờ qua.</p>';
    }

    // Group rows by source while preserving score-descending order — both
    // the source order (first appearance) and the rows within each group.
    const groups = new Map<string, DigestRow[]>();
    for (const row of rows) {
      const bucket = groups.get(row.source_name) ?? [];
      bucket.push(row);
      groups.set(row.source_name, bucket);
    }

    const groupsHtml = Array.from(groups.entries())
      .map(([sourceName, sourceRows]) => {
        const rowsHtml = sourceRows
          .map(
            (r, idx) => `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">
              <a href="${baseUrl}/tenders/${r.id}" style="color:#2563eb;text-decoration:none;">${escapeHtml(r.title)}</a>
            </td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(r.investor ?? '-')}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(r.locality ?? '-')}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;white-space:nowrap;">${formatCurrency(r.estimated_value, r.currency)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${r.final_score ?? '-'}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">${r.rubric_score ?? '-'}</td>
          </tr>`,
          )
          .join('');

        return `
        <h3 style="margin:20px 0 6px;color:#111827;">${escapeHtml(sourceName)} <span style="color:#6b7280;font-weight:normal;">(${sourceRows.length})</span></h3>
        <table style="border-collapse:collapse;font-size:14px;width:100%;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;border:1px solid #e5e7eb;">#</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Tên gói thầu</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Chủ đầu tư</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Địa phương</th>
              <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Giá trị</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Điểm AI</th>
              <th style="padding:8px;border:1px solid #e5e7eb;">Điểm tiêu chí</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
      })
      .join('');

    const minScoreNote =
      settings.minScore != null ? ` Chỉ gồm gói thầu có tổng điểm ≥ ${settings.minScore}.` : '';

    return `
      <div style="font-family:sans-serif;color:#111827;">
        <h2 style="margin-bottom:4px;">Top ${rows.length} gói thầu mới nổi bật hôm nay</h2>
        <p style="color:#6b7280;margin-top:0;">
          Tổng hợp các gói thầu crawl được trong 24 giờ qua, xếp theo tổng điểm AI + điểm tiêu chí, nhóm theo nguồn dữ liệu.${minScoreNote}
        </p>
        ${groupsHtml}
      </div>`;
  }
}
