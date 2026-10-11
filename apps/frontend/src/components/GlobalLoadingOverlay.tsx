import { Loader2 } from 'lucide-react';
import { useLoadingStore } from '../store/useLoadingStore';

export function GlobalLoadingOverlay() {
  const { isLoading, message } = useLoadingStore();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      {message && <p className="text-lg font-medium text-foreground">{message}</p>}
    </div>
  );
}
