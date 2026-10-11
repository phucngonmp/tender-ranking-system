import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { EmailDigestSetting } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Mail } from 'lucide-react';

function parseEmails(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function EmailDigestPage() {
  const queryClient = useQueryClient();
  const [recipientsText, setRecipientsText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('08:00');
  const [minScoreText, setMinScoreText] = useState('');
  const [topCount, setTopCount] = useState(5);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['email-digest', 'settings'],
    queryFn: async () => (await apiClient.get<EmailDigestSetting>('/email-digest/settings')).data,
  });

  useEffect(() => {
    if (settings) {
      setRecipientsText(settings.recipients.join(', '));
      setIsEnabled(settings.isEnabled);
      setSendTime(`${pad2(settings.sendHour)}:${pad2(settings.sendMinute)}`);
      setMinScoreText(settings.minScore != null ? String(settings.minScore) : '');
      setTopCount(settings.topCount);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const [hourStr, minuteStr] = sendTime.split(':');
      return apiClient.patch('/email-digest/settings', {
        recipients: parseEmails(recipientsText),
        isEnabled,
        sendHour: Number(hourStr) || 0,
        sendMinute: Number(minuteStr) || 0,
        minScore: minScoreText.trim() === '' ? null : Number(minScoreText),
        topCount: Number(topCount) || 5,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-digest'] }),
  });

  const sendNowMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ sent: boolean; recipientCount: number; tenderCount: number }>(
          '/email-digest/send-now',
        )
      ).data,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    saveMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Thông báo email</h1>
        <p className="text-sm text-muted-foreground">
          Mỗi ngày vào giờ đã chọn bên dưới, hệ thống gửi email tổng hợp top gói thầu mới crawl được trong 24
          giờ qua (xếp theo tổng điểm AI + điểm tiêu chí, nhóm theo nguồn dữ liệu) tới danh sách người nhận.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Cấu hình gửi mail</CardTitle>
            </div>
            <CardDescription>
              Việc gửi mail dùng chung tài khoản email công ty đã cấu hình SMTP ở biến môi trường phía máy chủ.
              {settings?.lastSentAt && (
                <> Lần gửi gần nhất: {new Date(settings.lastSentAt).toLocaleString('vi-VN')}.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form id="email-digest-form" onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Người nhận <span className="text-xs text-muted-foreground">(mail group hoặc cá nhân, cách nhau bằng dấu phẩy)</span>
                </label>
                <Textarea
                  placeholder="team@congty.com, nguoiquanly@congty.com"
                  value={recipientsText}
                  onChange={(e) => setRecipientsText(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Giờ gửi hằng ngày</label>
                  <input
                    type="time"
                    value={sendTime}
                    onChange={(e) => setSendTime(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Số lượng top gói thầu</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={topCount}
                    onChange={(e) => setTopCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">
                    Điểm tối thiểu <span className="text-xs text-muted-foreground">(để trống = không lọc)</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Không giới hạn"
                    value={minScoreText}
                    onChange={(e) => setMinScoreText(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Tổng điểm AI (/100) + điểm tiêu chí (/120)</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
                Bật gửi email tổng hợp hằng ngày
              </label>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" form="email-digest-form" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  'Lưu cấu hình'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={sendNowMutation.isPending}
                onClick={() => sendNowMutation.mutate()}
              >
                {sendNowMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Gửi thử ngay
                  </>
                )}
              </Button>
              {saveMutation.isSuccess && (
                <Badge variant="success">Đã lưu cấu hình</Badge>
              )}
            </div>

            {sendNowMutation.isSuccess && (
              <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                {sendNowMutation.data.sent ? (
                  <span className="text-emerald-600">
                    Đã gửi mail tới {sendNowMutation.data.recipientCount} người nhận,{' '}
                    {sendNowMutation.data.tenderCount} gói thầu trong nội dung.
                  </span>
                ) : (
                  <span className="text-amber-600">
                    Chưa gửi được — kiểm tra lại SMTP đã cấu hình ở máy chủ và danh sách người nhận (
                    {sendNowMutation.data.recipientCount} người nhận, {sendNowMutation.data.tenderCount} gói
                    thầu tìm thấy).
                  </span>
                )}
              </div>
            )}
            {sendNowMutation.isError && (
              <p className="mt-3 text-sm text-destructive">
                {(sendNowMutation.error as any)?.response?.data?.message ?? 'Gửi thử thất bại.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
