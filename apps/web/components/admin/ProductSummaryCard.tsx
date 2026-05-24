type ProductSummaryCardProps = {
  name: string;
  status: string;
  slug: string;
  thumbnailUrl: string | null;
  priceLabel: string;
  stockSummary: string;
  expanded: boolean;
  onToggle: () => void;
};

const statusStyles: Record<string, string> = {
  active:
    'border-green-300/40 bg-green-500/10 text-green-200',
  draft:
    'border-yellow-300/40 bg-yellow-500/10 text-yellow-100',
  inactive: 'border-red-300/40 bg-red-500/10 text-red-200',
};

export function ProductSummaryCard({
  name,
  status,
  slug,
  thumbnailUrl,
  priceLabel,
  stockSummary,
  expanded,
  onToggle,
}: ProductSummaryCardProps) {
  const statusClass =
    statusStyles[status] ??
    'border-purple-800 bg-purple-500/10 text-purple-200';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`flex cursor-pointer flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
        expanded
          ? 'border-purple-400/40 bg-purple-500/10 shadow-[0_0_28px_rgba(168,85,247,0.2)]'
          : 'border-purple-950 bg-[#0d0716] hover:border-purple-800'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-purple-950 bg-[#05070d] sm:h-20 sm:w-20">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-purple-900/40 to-[#07030d] text-lg font-black text-purple-400/80">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words font-black text-white sm:text-lg">{name}</p>
          <p className="mt-0.5 break-all text-xs text-gray-500">
            /product/{slug}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs ${statusClass}`}
            >
              {status}
            </span>
            <span className="text-sm text-purple-200 sm:text-base">
              {priceLabel}
            </span>
            <span className="text-sm text-gray-400 sm:text-base">
              {stockSummary}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end sm:pl-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="min-h-11 rounded-full border border-purple-300 bg-purple-300 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white hover:shadow-[0_0_35px_rgba(168,85,247,0.45)]"
        >
          {expanded ? 'Close' : 'Edit'}
        </button>
      </div>
    </div>
  );
}
