import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
import logoSvg from '@/assets/logo.svg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LayoutDashboard, Globe, BookOpen, History, Users, LogOut, ChevronUp, User2, Lock, Loader2, SlidersHorizontal, Mail, ListChecks, BarChart3 } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCrawlJobToasts } from '../hooks/useCrawlJobToasts';
import { CrawlJobToaster } from '@/components/ui-custom/crawl-job-toaster';

const navItems = [
  { to: '/tenders', label: 'Gói thầu', icon: LayoutDashboard },
  { to: '/closed-tender-list', label: 'Danh sách KQĐT', icon: ListChecks },
  { to: '/closed-tender-stats', label: 'Báo cáo & Đối thủ', icon: BarChart3 },
];

const adminNavItems = [
  { to: '/sources', label: 'Nguồn crawl', icon: Globe },
  { to: '/criteria-profiles', label: 'Hồ sơ công ty', icon: BookOpen },
  { to: '/scoring-criteria', label: 'Cấu hình chấm điểm', icon: SlidersHorizontal },
  { to: '/email-digest', label: 'Thông báo email', icon: Mail },
  { to: '/closed-tender-crawl-jobs', label: 'Lịch sử crawl KQĐT', icon: History },
  { to: '/crawl-jobs', label: 'Lịch sử crawl', icon: History },
  { to: '/users', label: 'Người dùng', icon: Users },
];

function isNavItemActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

// The sidebar's default data-active styling (bg-sidebar-accent) is a near-white
// tint on a near-white sidebar — barely perceptible. Override with the app's
// primary blue so the selected item is unmistakable. Uses data-[active=true]:
// (explicit value match) rather than the bare data-active: shorthand — the
// bare form only checks attribute *presence*, and SidebarMenuButton always
// renders data-active="true"/"false" (React never omits it), so the bare
// variant matched every item regardless of which one was actually selected.
const ACTIVE_NAV_CLASSNAME =
  'data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold ' +
  'data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary ' +
  'data-[active=true]:[&_svg]:text-primary';

function AppSidebar() {
  const { user, logout } = useAuth();
  const { state, isMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: async () =>
      apiClient.patch('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: () => {
      setIsChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      alert('Đổi mật khẩu thành công!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Lỗi đổi mật khẩu');
    }
  });

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div
          className={
            state === 'expanded'
              ? 'flex items-center gap-2.5 px-3 py-2 overflow-hidden select-none'
              : 'flex items-center justify-center py-2 overflow-hidden select-none'
          }
        >
          <img
            src={logoSvg}
            alt="TenderScope"
            className={
              state === 'expanded'
                ? 'h-8 w-8 shrink-0 rounded-lg shadow-sm transition-all duration-200'
                : 'h-7 w-7 shrink-0 rounded-lg shadow-sm transition-all duration-200'
            }
          />
          {state === 'expanded' && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-foreground truncate">
                TenderScope
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                AI Tender Intelligence
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Ứng dụng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={isNavItemActive(location.pathname, item.to)}
                    className={ACTIVE_NAV_CLASSNAME}
                  >
                    <Link to={item.to} className="flex w-full items-center gap-2">
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role?.toLowerCase() === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Quản trị viên</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      isActive={isNavItemActive(location.pathname, item.to)}
                      className={ACTIVE_NAV_CLASSNAME}
                    >
                      <Link to={item.to} className="flex w-full items-center gap-2">
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-slate-800 text-slate-50 shrink-0">
                    <span className="text-xs font-medium">
                      {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold">{user?.fullName || 'Supper Admin'}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email || 'administrator@skylabel.co.jp'}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
                className="w-56 rounded-lg z-50 p-1"
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-full border bg-background shrink-0">
                      <span className="text-xs font-medium text-foreground">
                        {user?.fullName ? user.fullName.substring(0, 2).toUpperCase() : 'CN'}
                      </span>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.fullName || 'Supper Admin'}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => setIsChangePasswordOpen(true)}
                >
                  <Lock className="size-4" />
                  <span>Đổi mật khẩu</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="cursor-pointer gap-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <LogOut className="size-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Đổi mật khẩu</DialogTitle>
                  <DialogDescription>
                    Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi. Mật khẩu mới phải có ít nhất 6 ký tự.
                  </DialogDescription>
                </DialogHeader>
                <form
                  id="user-change-password-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    changePasswordMutation.mutate();
                  }}
                  className="grid gap-4 py-2"
                >
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium">Mật khẩu hiện tại</label>
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu hiện tại"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
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
                  <Button type="button" variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    form="user-change-password-form"
                    disabled={changePasswordMutation.isPending || !currentPassword || newPassword.length < 6}
                  >
                    {changePasswordMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      'Xác nhận'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const { toasts, dismiss } = useCrawlJobToasts(user?.role === 'admin');

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <CrawlJobToaster toasts={toasts} dismiss={dismiss} />
    </TooltipProvider>
  );
}
