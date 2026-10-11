import React from 'react';
import { GebizDetailView } from './GebizDetailView';
import { FreetenderDetailView } from './FreetenderDetailView';
import { SamgovDetailView } from './SamgovDetailView';
import { StandardDetailView } from './StandardDetailView';
import {
  GebizStructuredPayload,
  FreetenderStructuredPayload,
  SamgovStructuredPayload,
  TenderDetailViewProps,
} from './types';

export * from './types';
export { GebizDetailView } from './GebizDetailView';
export { FreetenderDetailView } from './FreetenderDetailView';
export { SamgovDetailView } from './SamgovDetailView';
export { StandardDetailView } from './StandardDetailView';

/**
 * Registry of custom detail views for various procurement platforms.
 * Easily extendable: Just register a new platform key with its React component!
 */
export const DETAIL_VIEW_REGISTRY: Record<string, React.ComponentType<any>> = {
  gebiz: GebizDetailView,
  gebiz_keyword: GebizDetailView,
  freetender: FreetenderDetailView,
  freetender_keyword: FreetenderDetailView,
  samgov: SamgovDetailView,
  samgov_keyword: SamgovDetailView,
  standard: StandardDetailView,
};

function tryParseGebizData(
  descStr: string | null,
  reqStr: string | null
): GebizStructuredPayload | null {
  if (!descStr && !reqStr) return null;

  try {
    let parsedDesc: Partial<GebizStructuredPayload> = {};
    let parsedReq: Partial<GebizStructuredPayload> = {};

    if (descStr && descStr.trim().startsWith('{')) {
      const parsed = JSON.parse(descStr);
      if (parsed._format === 'gebiz_v1') {
        parsedDesc = parsed;
      }
    }

    if (reqStr && reqStr.trim().startsWith('{')) {
      const parsed = JSON.parse(reqStr);
      if (parsed._format === 'gebiz_v1') {
        parsedReq = parsed;
      }
    }

    if (parsedDesc._format === 'gebiz_v1' || parsedReq._format === 'gebiz_v1') {
      return {
        ...parsedDesc,
        ...parsedReq,
        contact: parsedDesc.contact ?? {},
        site_briefing: parsedDesc.site_briefing ?? {},
        specs: { ...(parsedDesc.specs ?? {}), ...(parsedReq.specs ?? {}) },
        line_items: parsedReq.line_items ?? parsedDesc.line_items ?? [],
        delivery_info: parsedReq.delivery_info ?? parsedDesc.delivery_info ?? [],
      };
    }
  } catch {
    // Fall back
  }

  return null;
}

function tryParseFreetenderData(
  descStr: string | null
): FreetenderStructuredPayload | null {
  if (!descStr || !descStr.trim().startsWith('{')) return null;

  try {
    const parsed = JSON.parse(descStr);
    if (parsed._format === 'freetender_v1') {
      return parsed as FreetenderStructuredPayload;
    }
  } catch {
    // Fall back
  }

  return null;
}

function tryParseSamgovData(
  descStr: string | null
): SamgovStructuredPayload | null {
  if (!descStr || !descStr.trim().startsWith('{')) return null;

  try {
    const parsed = JSON.parse(descStr);
    if (parsed._format === 'samgov_v1') {
      return parsed as SamgovStructuredPayload;
    }
  } catch {
    // Fall back
  }

  return null;
}

/**
 * Central Dispatcher Component that dynamically routes to the appropriate
 * detail view based on detected platform schema or source type.
 */
export function TenderDescriptionView(props: TenderDetailViewProps) {
  const { description, requirementsText, currency, sourceType } = props;

  // 1. Check for FreeTender structured data or source type
  const freetenderData = tryParseFreetenderData(description);
  if (
    freetenderData ||
    sourceType === 'freetender_keyword' ||
    sourceType === 'freetender'
  ) {
    const FreetenderComponent =
      DETAIL_VIEW_REGISTRY.freetender || FreetenderDetailView;
    return <FreetenderComponent {...props} payload={freetenderData} />;
  }

  // 2. Check for GeBIZ structured data or source type
  const gebizData = tryParseGebizData(description, requirementsText);
  if (
    gebizData ||
    currency === 'SGD' ||
    sourceType === 'gebiz_keyword' ||
    sourceType === 'gebiz'
  ) {
    const GebizComponent = DETAIL_VIEW_REGISTRY.gebiz || GebizDetailView;
    return <GebizComponent {...props} payload={gebizData} />;
  }

  // 3. Check for SAM.gov structured data or source type
  const samgovData = tryParseSamgovData(description);
  if (
    samgovData ||
    sourceType === 'samgov_keyword' ||
    sourceType === 'samgov'
  ) {
    const SamgovComponent = DETAIL_VIEW_REGISTRY.samgov || SamgovDetailView;
    return <SamgovComponent {...props} payload={samgovData} />;
  }

  // 4. Check for other registered source platforms
  if (sourceType && DETAIL_VIEW_REGISTRY[sourceType]) {
    const CustomView = DETAIL_VIEW_REGISTRY[sourceType];
    return <CustomView {...props} />;
  }

  // 5. Standard fallback (MuaSamCong, Bidwinner, DauThau.Asia, etc.)
  const FallbackView = DETAIL_VIEW_REGISTRY.standard || StandardDetailView;
  return <FallbackView {...props} />;
}
