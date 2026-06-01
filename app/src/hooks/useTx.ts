import { useCallback, useState } from "react";
import { txErrorMessage } from "../lib/anchor";

export interface TxMeta {
  fnName: string;
  sub?: string;
  variant?: "onchain" | "offchain";
}

/**
 * Drives a single in-flight transaction: shows the overlay while pending,
 * surfaces a readable error on failure, and runs an onSuccess callback (with
 * the resolved value, e.g. a tx signature) on success.
 */
export function useTx() {
  const [pending, setPending] = useState<TxMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T>(
      meta: TxMeta,
      thunk: () => Promise<T>,
      onSuccess?: (result: T) => void | Promise<void>,
    ): Promise<void> => {
      setError(null);
      setPending(meta);
      try {
        const result = await thunk();
        await onSuccess?.(result);
      } catch (e) {
        setError(txErrorMessage(e));
        // eslint-disable-next-line no-console
        console.error(`[${meta.fnName}]`, e);
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return { pending, error, setError, run };
}
