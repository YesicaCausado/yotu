"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";

export function CoupleTalkNotificationLink() {
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async (userId: string) => {
    const { count, error } = await createClient()
      .from("couple_talk_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("seen_at", null);
    if (error) throw new Error("No se pudieron cargar los avisos de Hablemos.");
    setUnread(count ?? 0);
    setFailed(false);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void getUser()
      .then(async (user) => {
        if (!active || !user) return;
        await refresh(user.id);
        if (!active) return;
        channel = supabase
          .channel(`couple-talk-notifications:${user.id}`)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "couple_talk_notifications",
            filter: `recipient_id=eq.${user.id}`,
          }, () => {
            void refresh(user.id).catch(() => setFailed(true));
          })
          .subscribe();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <Link
      href="/hablemos"
      aria-label={failed ? "No se pudieron cargar los avisos de Hablemos" : unread ? `Hablemos, ${unread} avisos sin leer` : "Hablemos"}
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-wine-700 transition-colors hover:bg-blush-100"
    >
      <MessageCircleHeart className="size-5" aria-hidden />
      {failed
        ? <span className="absolute right-0 top-0 size-2 rounded-full bg-danger-700" aria-hidden />
        : unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-wine-600 text-[0.65rem] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
    </Link>
  );
}
