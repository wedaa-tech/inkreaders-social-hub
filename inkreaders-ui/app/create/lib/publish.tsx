// app/create/lib/publish.tsx
import { useToast } from "@/app/components/ToastProvider";
import { fetchJson } from "@/app/create/lib/api";

export function usePublish() {
  const { push } = useToast();

  return {
    async publishAsNote(text: string) {
      if (!text?.trim()) {
        push({ variant: "error", title: "Nothing to publish", message: "Add some content first." });
        throw new Error("Nothing to publish");
      }
      try {
        await fetchJson(`/api/bsky/post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        push({ variant: "success", message: "Published to timeline ✅" });
      } catch (e: any) {
        push({ variant: "error", title: "Publish failed", message: e?.message ?? "Try again" });
        throw e;
      }
    },
  };
}
