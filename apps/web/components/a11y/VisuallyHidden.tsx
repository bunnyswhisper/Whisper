import type { ReactNode } from 'react';

type VisuallyHiddenProps = {
  children: ReactNode;
  as?: 'span' | 'label';
  htmlFor?: string;
  id?: string;
};

/** Screen-reader-only text; keeps visible layout unchanged. */
export function VisuallyHidden({ children, as = 'span', htmlFor, id }: VisuallyHiddenProps) {
  if (as === 'label') {
    return (
      <label htmlFor={htmlFor} id={id} className="sr-only">
        {children}
      </label>
    );
  }

  return (
    <span id={id} className="sr-only">
      {children}
    </span>
  );
}
