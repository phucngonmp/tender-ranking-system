import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { TenderDetail, PaginatedResponse, TenderEmailHistory } from '../types';
import { formatDate } from '../utils/format';
import { Loader2, Mail, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

export function SystemEmailHistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: response, isLoading } = useQuery({
    queryKey: ['system-email-histories', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<TenderDetail>>(`/tenders/email-histories/all?page=${page}&limit=${limit}`);
      return res.data;
    },
  });

  const tenders = response?.data || [];
  const meta = response?.meta;

  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Lịch sử Gửi Email</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Lịch sử các gói thầu đã gửi
          </CardTitle>
          <CardDescription>
            Danh sách các gói thầu đã được gửi email thông báo tới người dùng. Bấm "Xem chi tiết" để xem danh sách người nhận cụ thể.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Đang tải dữ liệu...
            </div>
          ) : !tenders || tenders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hệ thống chưa gửi email nào cho bất kỳ gói thầu nào.
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên gói thầu / Ngày gửi</TableHead>
                    <TableHead>Danh sách người nhận (tóm tắt)</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenders.map((tender) => {
                    const emails = tender.emailHistories || [];
                    // Get latest date
                    const latestDate = emails.length > 0 ? emails[0].sentAt : null;
                    // Get unique recipients
                    const recipients = Array.from(new Set(emails.map(e => e.recipient)));
                    
                    return (
                      <TableRow key={tender.id}>
                        <TableCell className="max-w-[400px]">
                          <Link 
                            to={`/tenders/${tender.id}`} 
                            className="font-medium text-sm text-primary hover:underline whitespace-normal break-words block"
                          >
                            {tender.title}
                          </Link>
                          {latestDate && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Gửi gần nhất: {formatDate(latestDate)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm whitespace-normal break-words">
                            Đã gửi tới <span className="font-semibold">{recipients.length}</span> người nhận.
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 whitespace-normal break-words max-w-[300px]">
                            {recipients.join(', ')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/tenders/${tender.id}/email-history`)}
                          >
                            Xem chi tiết
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {/* Pagination Controls */}
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
