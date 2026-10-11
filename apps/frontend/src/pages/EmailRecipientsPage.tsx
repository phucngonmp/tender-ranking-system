import { useState, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui-custom/confirm-dialog';
import { apiClient } from '../api/client';
import { RecipientStat, NotificationConfig } from '../types';
import { Loader2, Users, Trash2, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';

export function EmailRecipientsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);

  // Lấy config hiện tại để có emailRecipients gốc
  const { data: config } = useQuery({
    queryKey: ['notification-configs'],
    queryFn: async () => (await apiClient.get<NotificationConfig>('/notification-configs')).data,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['recipient-stats'],
    queryFn: async () => {
      const res = await apiClient.get<RecipientStat[]>('/notification-configs/recipients/stats');
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newRecipients: string[]) =>
      apiClient.put('/notification-configs', { emailRecipients: newRecipients }),
    onSuccess: () => {
      toast.success('Cập nhật danh sách người nhận thành công');
      queryClient.invalidateQueries({ queryKey: ['notification-configs'] });
      queryClient.invalidateQueries({ queryKey: ['recipient-stats'] });
      setDeleteEmail(null);
    },
    onError: (err: any) => {
      toast.error('Cập nhật thất bại: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleAddEmail = () => {
    if (!emailInput) return;
    const currentRecipients = config?.emailRecipients || [];
    if (!currentRecipients.includes(emailInput)) {
      updateMutation.mutate([...currentRecipients, emailInput]);
    }
    setEmailInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleRemoveEmail = (email: string) => {
    setDeleteEmail(email);
  };

  const handleConfirmDelete = () => {
    if (deleteEmail) {
      const currentRecipients = config?.emailRecipients || [];
      updateMutation.mutate(currentRecipients.filter(e => e !== deleteEmail));
    }
  };

  // Pagination logic
  const totalItems = stats?.length || 0;
  const paginatedStats = stats?.slice((page - 1) * limit, page * limit) || [];

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Danh sách Nhận thư</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quản lý Người nhận
          </CardTitle>
          <CardDescription>
            Danh sách các địa chỉ email được cấu hình nhận thông báo gói thầu tự động.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-6 max-w-md">
            <Input
              placeholder="Nhập địa chỉ email ngoài..."
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleAddEmail} disabled={updateMutation.isPending || !emailInput}>
              Thêm Email
            </Button>
          </div>

          {isStatsLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Đang tải danh sách...
            </div>
          ) : !stats || stats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-md">
              Chưa có ai trong danh sách nhận thư.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Phân loại</TableHead>
                      <TableHead className="text-center">Số thư đã nhận</TableHead>
                      <TableHead className="text-center">Số thư bị lỗi</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStats.map((stat) => (
                      <TableRow key={stat.email}>
                        <TableCell className="font-medium">{stat.email}</TableCell>
                        <TableCell>
                          {stat.type === 'internal' ? (
                            <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">
                              <UserCircle className="h-3 w-3" /> Hệ thống
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-orange-600 border-orange-200 bg-orange-50">
                              <Users className="h-3 w-3" /> Khách ngoài
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-green-600">{stat.successCount}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-destructive">{stat.failedCount}</span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/email-recipients/${stat.email}/history`)}
                          >
                            Xem lịch sử
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveEmail(stat.email)}
                            title="Xóa khỏi danh sách"
                            disabled={stat.type === 'internal'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination
                page={page}
                limit={limit}
                total={totalItems}
                onPageChange={setPage}
                onLimitChange={(l) => { setLimit(l); setPage(1); }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteEmail)}
        onOpenChange={(open) => !open && setDeleteEmail(null)}
        title="Xác nhận xóa người nhận"
        description={`Bạn có chắc muốn xóa ${deleteEmail} khỏi danh sách nhận thư không? Hành động này không thể hoàn tác.`}
        onConfirm={handleConfirmDelete}
        isPending={updateMutation.isPending}
        confirmText="Xóa"
      />
    </div>
  );
}
