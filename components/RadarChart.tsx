/** Topic-mastery radar (Learning DNA). Values are 0-100. */
export default function RadarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const cx = 160, cy = 140, R = 95, n = labels.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const poly = (r: (i: number) => number) => labels.map((_, i) => pt(i, r(i)).join(",")).join(" ");

  return (
    <svg viewBox="-75 0 470 270" role="img" aria-label="กราฟความสามารถรายหัวข้อ">
      {[25, 50, 75, 100].map((l) => (
        <polygon key={l} points={poly(() => (R * l) / 100)} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" />;
      })}
      <polygon points={poly((i) => (R * values[i]) / 100)} fill="var(--violet)" fillOpacity={0.22} stroke="var(--violet)" strokeWidth={2.5} strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, (R * v) / 100);
        return <circle key={i} cx={x} cy={y} r={4} fill="var(--violet)" />;
      })}
      {labels.map((l, i) => {
        const [x, y] = pt(i, R + 18);
        const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
        return (
          <text key={l} x={x} y={y + (y < cy - R / 2 ? -2 : 6)} textAnchor={anchor}>
            {l} <tspan fontWeight={600} fill="var(--ink)">{values[i]}%</tspan>
          </text>
        );
      })}
    </svg>
  );
}
