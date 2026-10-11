/** Horizontal bar chart — 1 series (magnitude), tuân theo mark spec: thanh tối đa
 * 24px, bo tròn đầu, nhãn giá trị ở cuối thanh, không cần chú giải vì chỉ 1 màu. */
export function HBarChart({
  items,
  max,
}: {
  items: { label: string; value: number; title: string }[];
  max: number;
}) {
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const widthPct = Math.max(2, (item.value / max) * 100);
        return (
          <div key={item.label} className="flex items-center gap-3" title={item.title}>
            <div className="w-40 shrink-0 text-xs text-foreground text-right leading-snug whitespace-normal break-words">
              {item.label}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${widthPct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-xs font-medium text-foreground tabular-nums">{item.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
