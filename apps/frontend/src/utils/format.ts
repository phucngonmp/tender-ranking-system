export function formatCurrency(value: string | number | null | undefined, currency = 'VND'): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '-';
  return `${new Intl.NumberFormat('vi-VN').format(num)} ${currency}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('vi-VN');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export function formatDateTimeShort(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const datePart = date.toLocaleDateString('vi-VN');
  const timePart = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

export type TenderStatus = 'open' | 'closed' | 'unknown';

/** Đang mở thầu / đã đóng thầu, tính từ hạn nộp (submission_deadline) so với hiện tại. */
export function getTenderStatus(deadline: string | null | undefined): TenderStatus {
  if (!deadline) return 'unknown';
  const deadlineTime = new Date(deadline).getTime();
  if (Number.isNaN(deadlineTime)) return 'unknown';
  return deadlineTime > Date.now() ? 'open' : 'closed';
}

export const TENDER_STATUS_LABELS: Record<TenderStatus, string> = {
  open: 'Đang mở thầu',
  closed: 'Đã đóng thầu',
  unknown: 'Không rõ',
};

export const VERDICT_LABELS: Record<string, string> = {
  GO: 'GO',
  CONSIDER: 'CONSIDER',
  NO_GO: 'NO-GO',
};

export const VERDICT_BADGE_CLASS: Record<string, string> = {
  GO: 'high',
  CONSIDER: 'medium',
  NO_GO: 'low',
};

export const SINGAPORE_GRA_RANGES: Record<string, { floor: number; ceiling: number; label: string }> = {
  'EPU S1': { floor: 0, ceiling: 50000, label: '< 50.000 SGD' },
  'EPU S2': { floor: 50000, ceiling: 100000, label: '50.000 - 100.000 SGD' },
  'EPU S3': { floor: 100000, ceiling: 250000, label: '100.000 - 250.000 SGD' },
  'EPU S4': { floor: 250000, ceiling: 500000, label: '250.000 - 500.000 SGD' },
  'EPU S5': { floor: 500000, ceiling: 1000000, label: '500.000 - 1.000.000 SGD' },
  'EPU S6': { floor: 1000000, ceiling: 3000000, label: '1.000.000 - 3.000.000 SGD' },
  'EPU S7': { floor: 3000000, ceiling: 5000000, label: '3.000.000 - 5.000.000 SGD' },
  'EPU S8': { floor: 5000000, ceiling: 10000000, label: '5.000.000 - 10.000.000 SGD' },
  'EPU S9': { floor: 10000000, ceiling: 30000000, label: '10.000.000 - 30.000.000 SGD' },
  'EPU S10': { floor: 30000000, ceiling: 50000000, label: '> 30.000.000 SGD' },

  'BCA C3': { floor: 0, ceiling: 650000, label: '< 650.000 SGD' },
  'BCA C2': { floor: 650000, ceiling: 1300000, label: '650.000 - 1.300.000 SGD' },
  'BCA C1': { floor: 1300000, ceiling: 4000000, label: '1.300.000 - 4.000.000 SGD' },
  'BCA B2': { floor: 4000000, ceiling: 13000000, label: '4.000.000 - 13.000.000 SGD' },
  'BCA B1': { floor: 13000000, ceiling: 40000000, label: '13.000.000 - 40.000.000 SGD' },
  'BCA A2': { floor: 40000000, ceiling: 85000000, label: '40.000.000 - 85.000.000 SGD' },
  'BCA A1': { floor: 85000000, ceiling: 100000000, label: '> 85.000.000 SGD' },
};

export interface SingaporePriceInfo {
  displayRange: string;
  ceilingText: string;
  gradeCode?: string;
}

export function getSingaporeEstimatedPriceInfo(
  estimatedValue: number | string | null | undefined,
  currency?: string | null,
  textContext?: string | null,
  externalCode?: string | null
): SingaporePriceInfo | null {
  if (currency !== 'SGD') return null;

  const combinedText = `${textContext ?? ''} ${externalCode ?? ''}`;

  // 1. Match explicit grade code in text (e.g. EPU S3, BCA C1)
  const gradeMatch = combinedText.match(/\b(EPU\s*S\d+|BCA\s*[A-C]\d+)\b/i);
  if (gradeMatch) {
    const normalized = gradeMatch[1].replace(/\s+/g, ' ').toUpperCase();
    const info = SINGAPORE_GRA_RANGES[normalized];
    if (info) {
      return {
        displayRange: info.label,
        ceilingText: `Trần tối đa: ${new Intl.NumberFormat('vi-VN').format(info.ceiling)} SGD`,
        gradeCode: normalized,
      };
    }
  }

  // 2. Match standard financial grade ceiling value
  const numVal = typeof estimatedValue === 'string' ? Number(estimatedValue) : estimatedValue;
  if (numVal && !Number.isNaN(numVal)) {
    for (const [grade, info] of Object.entries(SINGAPORE_GRA_RANGES)) {
      if (info.ceiling === numVal) {
        return {
          displayRange: info.label,
          ceilingText: `Trần tối đa: ${new Intl.NumberFormat('vi-VN').format(numVal)} SGD`,
          gradeCode: grade,
        };
      }
    }
  }

  // 3. Fallback by opportunity type in external code
  const codeUpper = (externalCode ?? '').toUpperCase();
  if (codeUpper.includes('ETQ')) {
    return {
      displayRange: '< 90.000 SGD',
      ceilingText: 'Trần luật định: < 90.000 SGD (Quotation)',
      gradeCode: 'Quotation',
    };
  }
  if (codeUpper.includes('ETL')) {
    return {
      displayRange: '90.000 - 1.000.000 SGD',
      ceilingText: 'Trần luật định: 90.000 - 1.000.000 SGD (Tender Lite)',
      gradeCode: 'Tender Lite',
    };
  }
  if (codeUpper.includes('ETT')) {
    return {
      displayRange: '> 1.000.000 SGD',
      ceilingText: 'Quy mô luật định: > 1.000.000 SGD (Tender)',
      gradeCode: 'Tender',
    };
  }

  return null;
}
