type MetricCardProps = {
  title: string;
  value: string;
  hint?: string;
  detail?: string;
  glow?: boolean;
};

export function MetricCard({
  title,
  value,
  hint,
  detail,
  glow = false,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-3xl border p-5 sm:p-6 ${
        glow
          ? 'border-purple-300/30 bg-purple-500/10 shadow-[0_0_50px_rgba(168,85,247,0.25)]'
          : 'border-purple-950 bg-[#0d0716]'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-gray-300 sm:text-sm">
        {title}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug text-gray-500">{hint}</p>
      ) : null}
      <p className="mt-3 break-words text-3xl font-black tracking-tight text-white drop-shadow-[0_0_14px_rgba(216,180,254,0.35)] sm:text-4xl">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm font-semibold leading-snug text-purple-200/90">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
