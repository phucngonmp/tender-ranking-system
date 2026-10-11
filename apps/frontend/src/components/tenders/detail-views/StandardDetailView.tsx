import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TenderDetailViewProps } from './types';

export function StandardDetailView({
  description,
  requirementsText,
}: TenderDetailViewProps) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle>Mô tả</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {description ?? 'Không có mô tả.'}
          </p>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu kỹ thuật</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {requirementsText ?? 'Không có thông tin.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
