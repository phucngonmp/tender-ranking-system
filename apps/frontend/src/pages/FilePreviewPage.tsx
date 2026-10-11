import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import mammoth from 'mammoth';
import { Loader2 } from 'lucide-react';
import { TenderDetail, TenderAttachment } from '../types';

export function FilePreviewPage() {
  const { id, fileId } = useParams<{ id: string; fileId: string }>();
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: tender, isLoading: isLoadingTender } = useQuery({
    queryKey: ['tender', id],
    queryFn: async () => {
      const response = await apiClient.get<TenderDetail>(`/tenders/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const file = tender?.attachments?.find((a) => a.id === fileId);

  useEffect(() => {
    if (!file) return;

    let isMounted = true;
    const token = tokenStore.getAccessToken();
    const url = `/api/tenders/${id}/attachments/${file.id}/download?inline=true`;

    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
      })
      .then(async (blob) => {
        if (!isMounted) return;
        const ext = file.fileName.split('.').pop()?.toLowerCase();
        if (ext === 'docx' || ext === 'doc') {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          if (isMounted) setDocxHtml(result.value);
        } else {
          const blobUrl = URL.createObjectURL(blob);
          if (isMounted) setPreviewBlobUrl(blobUrl);
        }
      })
      .catch((err) => {
        if (isMounted) setError('Không thể xem trước file: ' + err.message);
      });

    return () => {
      isMounted = false;
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [file, id]);

  if (isLoadingTender) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        File không tồn tại hoặc bạn không có quyền xem.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  if (!docxHtml && !previewBlobUrl) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Đang tải nội dung file...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-muted/20">
      <div className="flex h-14 items-center border-b border-border bg-background px-6 shadow-sm">
        <h1 className="text-sm font-medium text-foreground">
          Đang xem: <span className="text-muted-foreground">{file.fileName}</span>
        </h1>
      </div>
      <div className="h-[calc(100vh-3.5rem)] w-full overflow-auto p-4">
        {docxHtml && (
          <div
            className="mx-auto max-w-4xl bg-white px-12 py-10 font-serif text-sm leading-relaxed min-h-full shadow-sm"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        )}
        {previewBlobUrl && (
          <iframe
            src={previewBlobUrl}
            className="block h-full w-full border-0 bg-white shadow-sm"
            title={file.fileName}
          />
        )}
      </div>
    </div>
  );
}
