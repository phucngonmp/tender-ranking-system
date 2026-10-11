import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { TenderEmailHistory, PaginatedResponse } from '../types';
import { formatDate } from '../utils/format';
import { ArrowLeft, Loader2, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function TenderEmailHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: response, isLoading } = useQuery({
    queryKey: ['tender-email-histories', id, page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<TenderEmailHistory>>(`/tenders/${id}/email-histories?page=${page}&limit=${limit}`);
      return res.data;
    },
    enabled: !!id,
  });

  const histories = response?.data || [];
  const meta = response?.meta;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Đang tải lịch sử...
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Chi tiết Lịch sử Gửi thư</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Danh sách email đã gửi cho gói thầu này
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!histories || histories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có email nào được gửi cho gói thầu này.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian gửi</TableHead>
                    <TableHead>Người nhận</TableHead>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histories.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(h.sentAt)}
                      </TableCell>
                      <TableCell className="font-medium">{h.recipient}</TableCell>
                      <TableCell className="max-w-[300px] whitespace-normal break-words" title={h.subject}>
                        {h.subject}
                      </TableCell>
                      <TableCell>
                        {h.status === 'success' ? (
                          <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3" /> Thành công
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1" title={h.errorMsg || 'Lỗi'}>
                            <XCircle className="h-3 w-3" /> Thất bại
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {meta && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Hiển thị trang {meta.page} / {meta.totalPages || 1} (Tổng {meta.total} thư)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                      disabled={page === meta.totalPages || meta.totalPages <= 1}
                    >
                      Tiếp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
