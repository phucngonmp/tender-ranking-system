/** Vertical bar chart cho chuỗi thời gian — 1 series (số lượng), cột mảnh bo
 * tròn đầu, nhãn giá trị phía trên cột, nhãn phụ (vd. tỷ lệ trúng) phía dưới
 * nhãn trục để tránh biểu đồ 2 trục. */
export function VBarChart({
  items,
  max,
  height = 150,
}: {
  items: { label: string; value: number; sublabel?: string; title: string }[];
  max: number;
  height?: number;
}) {
  const barAreaHeight = height - 34;

  return (
    <div className="flex items-end gap-2 overflow-x-auto" style={{ height }}>
      {items.map((item) => {
        const barHeight = Math.max(3, Math.round((item.value / max) * barAreaHeight));
        return (
          <div
            key={item.label}
            className="flex flex-col items-center justify-end shrink-0 w-10 h-full"
            title={item.title}
          >
            <span className="text-[10px] font-medium text-foreground tabular-nums mb-1">{item.value}</span>
            <div className="w-full flex justify-center" style={{ height: barAreaHeight }}>
              <div
                className="w-6 rounded-t-sm bg-primary self-end transition-all"
                style={{ height: barHeight }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">{item.label}</span>
            {item.sublabel && <span className="text-[9px] text-muted-foreground/80">{item.sublabel}</span>}
          </div>
        );
      })}
    </div>
  );
}
