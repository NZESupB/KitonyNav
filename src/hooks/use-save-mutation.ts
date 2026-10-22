import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";

type Submission<T> = { id?: number; payload: T };

export function useSaveMutation<T>(
  create: (payload: T) => Promise<unknown>,
  update: (id: number, payload: T) => Promise<unknown>,
  onSuccess: () => void,
  onError: (error: Error) => void,
) {
  const locked = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ id, payload }: Submission<T>) => id == null ? create(payload) : update(id, payload),
    onSuccess,
    onError,
    onSettled: () => { locked.current = false; },
  });
  return {
    isPending: mutation.isPending,
    save(id: number | undefined, payload: T) {
      // React 尚未完成下一次渲染时，也只允许一次提交。
      if (locked.current) return;
      locked.current = true;
      mutation.mutate({ id, payload });
    },
  };
}
