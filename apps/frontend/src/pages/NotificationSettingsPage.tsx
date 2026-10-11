import { FormEvent, useState, useEffect, KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { NotificationConfig, User, TenderVerdict } from '../types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, BellRing, Save, Trash2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  // Settings states
  const [emailsEnabled, setEmailsEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');

  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookType, setWebhookType] = useState('telegram');

  const [minScoreThreshold, setMinScoreThreshold] = useState(60);
  const [allowedVerdicts, setAllowedVerdicts] = useState<TenderVerdict[]>(['GO', 'CONSIDER']);

  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [includeAiAnalysis, setIncludeAiAnalysis] = useState(true);

  const { data: config, isLoading } = useQuery({
    queryKey: ['notification-configs'],
    queryFn: async () => (await apiClient.get<NotificationConfig>('/notification-configs')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await apiClient.get<User[]>('/users')).data,
  });

  useEffect(() => {
    if (config) {
      setEmailsEnabled(config.emailsEnabled);
      setEmailRecipients(config.emailRecipients || []);
      setWebhookEnabled(config.webhookEnabled);
      setWebhookUrl(config.webhookUrl || '');
      setWebhookType(config.webhookType || 'telegram');
      setMinScoreThreshold(config.minScoreThreshold);
      setAllowedVerdicts(config.allowedVerdicts || []);
      setIncludeAttachments(config.includeAttachments || false);
      setIncludeAiAnalysis(config.includeAiAnalysis ?? true);
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<NotificationConfig>) =>
      apiClient.put('/notification-configs', data),
    onSuccess: () => {
      toast.success('Lưu cấu hình thông báo thành công');
      queryClient.invalidateQueries({ queryKey: ['notification-configs'] });
    },
    onError: (err: any) => {
      toast.error('Lưu cấu hình thất bại: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      emailsEnabled,
      emailRecipients,
      webhookEnabled,
      webhookUrl,
      webhookType,
      minScoreThreshold,
      allowedVerdicts,
      includeAttachments,
      includeAiAnalysis,
    });
  };

  const handleAddEmail = () => {
    if (emailInput && !emailRecipients.includes(emailInput)) {
      setEmailRecipients([...emailRecipients, emailInput]);
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const toggleVerdict = (verdict: TenderVerdict) => {
    if (allowedVerdicts.includes(verdict)) {
      setAllowedVerdicts(allowedVerdicts.filter(v => v !== verdict));
    } else {
      setAllowedVerdicts([...allowedVerdicts, verdict]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Đang tải cấu hình...
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <BellRing className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Cấu hình EMail</h1>
      </div>

      <form onSubmit={handleSave} className="grid gap-6">

        {/* SECTION 1: Email Content Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cấu hình Nội dung Email</CardTitle>
            <CardDescription>Chọn các thành phần bạn muốn gửi kèm theo trong email thông báo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="switch-attachments" className="text-sm font-medium cursor-pointer">Gửi kèm file đính kèm gói thầu</label>
                <p className="text-xs text-muted-foreground">Tự động đính kèm HSMT, Quyết định phê duyệt... vào email</p>
              </div>
              <Switch id="switch-attachments" checked={includeAttachments} onCheckedChange={setIncludeAttachments} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="switch-ai" className="text-sm font-medium cursor-pointer">Đính kèm phân tích AI & Điểm số</label>
                <p className="text-xs text-muted-foreground">Hiển thị đánh giá của AI về gói thầu trực tiếp trên thư</p>
              </div>
              <Switch id="switch-ai" checked={includeAiAnalysis} onCheckedChange={setIncludeAiAnalysis} />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Điều kiện gửi thông báo</CardTitle>
            <CardDescription>Lọc các gói thầu đáp ứng tiêu chí mới gửi thông báo để tránh làm phiền</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Điểm AI tối thiểu (0 - 100)</label>
              <Input
                type="number"
                min="0"
                max="100"
                className="w-[120px]"
                value={minScoreThreshold}
                onChange={(e) => setMinScoreThreshold(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Xếp loại gói thầu (Verdict)</label>
              <div className="flex gap-4">
                {(['GO', 'CONSIDER', 'NO_GO'] as TenderVerdict[]).map((verdict) => (
                  <label key={verdict} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary h-4 w-4 rounded"
                      checked={allowedVerdicts.includes(verdict)}
                      onChange={() => toggleVerdict(verdict)}
                    />
                    {verdict}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2 pb-10">
          <Button type="submit" size="lg" className="gap-2" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu cấu hình
          </Button>
        </div>
      </form>
    </div>
  );
}
