import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { CrawlJob, CrawlJobStatus } from '../types';

export interface CrawlJobToast {
  id: string;
  sourceName: string;
  status: Extract<CrawlJobStatus, 'success' | 'failed'>;
  itemsFound: number;
}

const POLL_INTERVAL_MS = 5000;
const AUTO_DISMISS_MS = 15000;

export function useCrawlJobToasts(enabled: boolean) {
  const [toasts, setToasts] = useState<CrawlJobToast[]>([]);
  const seenStatus = useRef<Map<string, CrawlJobStatus>>(new Map());
  const isFirstLoad = useRef(true);

  const { data } = useQuery({
    queryKey: ['crawl-jobs', 'recent-poll'],
    queryFn: async () =>
      (await apiClient.get<CrawlJob[]>('/crawl-jobs', { params: { limit: 20 } })).data,
    enabled,
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    if (!data) return;

    if (isFirstLoad.current) {
      for (const job of data) seenStatus.current.set(job.id, job.status);
      isFirstLoad.current = false;
      return;
    }

    const newlyFinished: CrawlJobToast[] = [];
    for (const job of data) {
      const prev = seenStatus.current.get(job.id);
      // A job not seen before this poll but already done (prev === undefined) means it was
      // both created and finished within one poll interval — still a genuinely new completion,
      // not a stale historical job (those were already baselined on first load above).
      const wasInFlightOrUnseen = prev === 'pending' || prev === 'running' || prev === undefined;
      if (wasInFlightOrUnseen && (job.status === 'success' || job.status === 'failed')) {
        newlyFinished.push({
          id: job.id,
          sourceName: job.source.name,
          status: job.status,
          itemsFound: job.itemsFound,
        });
      }
      seenStatus.current.set(job.id, job.status);
    }

    if (newlyFinished.length > 0) {
      setToasts((prev) => [...newlyFinished, ...prev]);
      for (const toast of newlyFinished) {
        setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { toasts, dismiss };
}
