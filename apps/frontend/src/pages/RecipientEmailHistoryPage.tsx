import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { TenderEmailHistory, PaginatedResponse } from '../types';
import { formatDate } from '../utils/format';
import { Loader2, Mail, ExternalLink, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';

export function RecipientEmailHistoryPage() {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: response, isLoading } = useQuery({
    queryKey: ['email-histories-by-recipient', email, page, limit],
    queryFn: async () => {
      if (!email) return null;
      const res = await apiClient.get<PaginatedResponse<TenderEmailHistory>>(`/tenders/email-histories/by-recipient?email=${email}&page=${page}&limit=${limit}`);
      return res.data;
    },
    enabled: !!email,
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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/email-recipients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Chi tiết Lịch sử Gửi thư</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Danh sách email đã gửi
          </CardTitle>
          <CardDescription>
            Lịch sử toàn bộ email thông báo đã gửi cho người dùng: <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!histories || histories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-md bg-muted/20">
              Chưa có lịch sử gửi thư cho người dùng này.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {histories.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                        {formatDate(h.sentAt)}
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <div className="font-medium text-sm whitespace-normal break-words">{h.subject}</div>
                        {h.tender && (
                          <div className="mt-1 flex items-center gap-1">
                            <Link 
                              to={`/tenders/${h.tenderId}`}
                              className="text-xs text-primary hover:underline whitespace-normal break-words"
                            >
                              Gói thầu: {h.tender.title}
                            </Link>
                            <ExternalLink className="h-3 w-3 text-primary flex-shrink-0" />
                          </div>
                        )}
                        {h.status === 'failed' && h.errorMsg && (
                          <div className="mt-2 text-xs text-destructive font-mono bg-destructive/10 p-1.5 rounded whitespace-normal break-words">
                            {h.errorMsg}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {h.status === 'success' ? (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Thành công</Badge>
                        ) : (
                          <Badge variant="destructive">Thất bại</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {meta && (
                <DataTablePagination
                  page={page}
                  limit={limit}
                  total={meta.total}
                  onPageChange={setPage}
                  onLimitChange={(l) => { setLimit(l); setPage(1); }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
