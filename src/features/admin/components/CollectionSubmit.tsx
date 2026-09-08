"use client";
import { useFormStatus } from "react-dom";
export function CollectionSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button" disabled={pending} aria-live="polite">
      {pending ? "수집 처리 중…" : children}
    </button>
  );
}
