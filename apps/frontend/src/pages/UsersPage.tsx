import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { RoleName, User } from '../types';
import { useUrlParams } from '../hooks/useUrlParams';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ui-custom/confirm-delete-dialog';
import { DataTablePagination } from '@/components/ui-custom/data-table-pagination';
import { UserPlus, Trash2, Loader2, Copy, Search, Key } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [changePasswordId, setChangePasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<RoleName>('member');
  const [lastTemporaryPassword, setLastTemporaryPassword] = useState<string | null>(null);

  // URL params persistence
  const { params, setParams } = useUrlParams({
    search: '',
    role: '',
    page: 1,
    limit: 10,
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get<User[]>('/users')).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post('/users', { email, fullName, role })).data as {
        temporaryPassword: string;
      },
    onSuccess: (data) => {
      setEmail('');
      setFullName('');
      setRole('member');
      setLastTemporaryPassword(data.temporaryPassword);
      setIsCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: Partial<Pick<User, 'role' | 'isActive'> & { password: string }> }) =>
      apiClient.patch(`/users/${payload.id}`, payload.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  // Filter users
  const filteredUsers = users?.filter(
    (u) =>
      (params.search === '' ||
        u.email.toLowerCase().includes(params.search.toLowerCase()) ||
        u.fullName.toLowerCase().includes(params.search.toLowerCase())) &&
      (!params.role || (typeof u.role === 'object' ? (u.role as any).name : u.role) === params.role)
  );

  const total = filteredUsers?.length || 0;
  const paginatedUsers = filteredUsers?.slice(
    (params.page - 1) * params.limit,
    params.page * params.limit
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Người dùng</h1>

      {/* Filter & Action */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[240px] max-w-md flex-1">
            <label className="text-xs font-medium text-muted-foreground">Email hoặc Họ tên</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo email hoặc họ tên..."
                className="pl-9 h-9 text-sm"
                value={params.search}
                onChange={(e) => setParams({ search: e.target.value, page: 1 })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 w-[140px]">
            <label className="text-xs font-medium text-muted-foreground">Vai trò</label>
            <Select
              value={params.role || 'all'}
              onValueChange={(val) => setParams({ role: val === 'all' ? '' : val, page: 1 })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tất cả vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả vai trò</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          {/* Dialog Create Form */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs">
                <UserPlus className="h-4 w-4" />
                Tạo người dùng
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Tạo tài khoản người dùng</DialogTitle>
              <DialogDescription>
                Hệ thống sẽ tự động tạo mật khẩu tạm thời để gửi cho người dùng mới.
              </DialogDescription>
            </DialogHeader>

            <form id="create-user-form" onSubmit={handleCreate} className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Họ và tên</label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Vai trò</label>
                <Select value={role} onValueChange={(val) => setRole(val as RoleName)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </form>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" form="create-user-form" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  'Tạo tài khoản'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Temp password notification box */}
      {lastTemporaryPassword && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30 dark:border-emerald-800">
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            Mật khẩu tạm thời vừa tạo:{' '}
            <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono font-semibold dark:bg-emerald-900">
              {lastTemporaryPassword}
            </code>
            {' '}— Hãy gửi thông tin này cho người dùng.
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => navigator.clipboard.writeText(lastTemporaryPassword)}
            className="gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
          >
            <Copy className="h-3.5 w-3.5" />
            Sao chép
          </Button>
        </div>
      )}



      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Hoạt động</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-muted-foreground">{user.fullName}</TableCell>
                  <TableCell>
                    <Select
                      value={typeof user.role === 'object' ? (user.role as any).name : user.role}
                      onValueChange={(val) =>
                        updateMutation.mutate({
                          id: user.id,
                          data: { role: val as RoleName },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={user.isActive}
                      className="h-4 w-4 accent-primary cursor-pointer"
                      onChange={(e) =>
                        updateMutation.mutate({ id: user.id, data: { isActive: e.target.checked } })
                      }
                    />
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setChangePasswordId(user.id)}
                    >
                      <Key className="h-3.5 w-3.5 mr-1" />
                      Đổi mật khẩu
                    </Button>
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => setDeleteId(user.id)}
                      disabled={currentUser?.id === user.id}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Xoá
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedUsers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Không tìm thấy người dùng nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* DataTablePagination */}
          <DataTablePagination
            page={params.page}
            limit={params.limit}
            total={total}
            onPageChange={(p) => setParams({ page: p })}
            onLimitChange={(l) => setParams({ limit: l, page: 1 })}
          />
        </>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDeleteDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Xác nhận xóa người dùng"
        description="Bạn có chắc chắn muốn xóa tài khoản người dùng này không? Hành động này không thể hoàn tác."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        isPending={deleteMutation.isPending}
      />

      {/* Change Password Dialog */}
      <Dialog
        open={Boolean(changePasswordId)}
        onOpenChange={(open) => {
          if (!open) {
            setChangePasswordId(null);
            setNewPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu người dùng</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu mới cho người dùng này. Mật khẩu phải có ít nhất 6 ký tự.
            </DialogDescription>
          </DialogHeader>
          <form
            id="change-password-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (changePasswordId) {
                updateMutation.mutate(
                  { id: changePasswordId, data: { password: newPassword } },
                  {
                    onSuccess: () => {
                      setChangePasswordId(null);
                      setNewPassword('');
                    },
                  }
                );
              }
            }}
            className="grid gap-4 py-2"
          >
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Mật khẩu mới</label>
              <Input
                type="password"
                placeholder="Nhập mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChangePasswordId(null)}>
              Hủy
            </Button>
            <Button type="submit" form="change-password-form" disabled={updateMutation.isPending || newPassword.length < 6}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang cập nhật...
                </>
              ) : (
                'Cập nhật'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
