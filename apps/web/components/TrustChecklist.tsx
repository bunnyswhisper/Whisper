function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M16.25 5.625L8.125 13.75L3.75 9.375"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TrustChecklist({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2.5 text-sm text-gray-400">
      {items.map((text) => (
        <li key={text} className="flex items-start gap-2.5">
          <span className="mt-0.5 text-green-400">
            <CheckIcon />
          </span>
          <span className="leading-snug">{text}</span>
        </li>
      ))}
    </ul>
  );
}
