'use client';

import { useEffect, useRef, useState } from 'react';

export type ProductBasicDraft = {
  name: string;
  description: string;
  base_price: string;
  sale_price: string;
};

type AdminProductBasicFieldsProps = {
  productId: string;
  seed: ProductBasicDraft;
  inputClass: string;
  onDraftChange: (productId: string, draft: ProductBasicDraft) => void;
};

export function AdminProductBasicFields({
  productId,
  seed,
  inputClass,
  onDraftChange,
}: AdminProductBasicFieldsProps) {
  const productIdRef = useRef(productId);
  const [draft, setDraft] = useState(seed);

  useEffect(() => {
    if (productIdRef.current === productId) return;
    productIdRef.current = productId;
    setDraft(seed);
  }, [productId, seed]);

  function update(patch: Partial<ProductBasicDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      onDraftChange(productId, next);
      return next;
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <input
        value={draft.name}
        onChange={(e) => update({ name: e.target.value })}
        className={inputClass}
        placeholder="Product name"
      />

      <input
        type="number"
        value={draft.base_price}
        onChange={(e) => update({ base_price: e.target.value })}
        className={inputClass}
        placeholder="Base price"
      />

      <input
        type="number"
        value={draft.sale_price}
        onChange={(e) => update({ sale_price: e.target.value })}
        className={inputClass}
        placeholder="Sale price optional"
      />

      <textarea
        value={draft.description}
        onChange={(e) => update({ description: e.target.value })}
        className={`${inputClass} md:col-span-2 min-h-28 w-full`}
        placeholder="Description"
      />
    </div>
  );
}
