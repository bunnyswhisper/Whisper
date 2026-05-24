import type { ReactNode } from 'react';

export function LegalP({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

export function LegalUl({ children }: { children: ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-purple-400/80">
      {children}
    </ul>
  );
}

export function LegalLi({ children }: { children: ReactNode }) {
  return <li>{children}</li>;
}

export function LegalStrong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-gray-100">{children}</strong>;
}
