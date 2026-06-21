/**
 * Coalesce concurrent identical async work (e.g. multiple components mounting together).
 */
export function createInflightDedupe<T>() {
  let inflight: Promise<T> | null = null;

  return (run: () => Promise<T>): Promise<T> => {
    if (inflight) return inflight;

    inflight = run().finally(() => {
      inflight = null;
    });

    return inflight;
  };
}
