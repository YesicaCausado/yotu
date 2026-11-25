"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";

export function SurpriseNotificationLink() {
  const [unread, setUnread] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async (userId: string) => {
    const { count, error } = await createClient()
      .from("appointment_surprise_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("seen_at", null);
    if (error) {
      setUnavailable(true);
      return;
    }
    setUnread(count ?? 0);
    setUnavailable(false);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let syncTimer: number | null = null;
    void getUser()
      .then((user) => {
        if (!active || !user) return;
        const sync = async () => {
          const { error } = await supabase.rpc("sync_appointment_surprise_notifications");
          if (error) {
            setUnavailable(true);
            return;
          }
          await refresh(user.id);
        };
        void sync().catch(() => setUnavailable(true));
        syncTimer = window.setInterval(() => {
          void sync().catch(() => setUnavailable(true));
        }, 30_000);
        channel = supabase
          .channel(`surprise-notifications:${user.id}`)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "appointment_surprise_notifications",
            filter: `recipient_id=eq.${user.id}`,
          }, () => { void refresh(user.id); })
          .subscribe();
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
      if (syncTimer !== null) window.clearInterval(syncTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <Link
      href="/citas"
      aria-label={unavailable ? "Avisos de sorpresas no disponibles" : `Sorpresas${unread ? `, ${unread} sin leer` : ""}`}
      title={unavailable ? "No se pudieron cargar los avisos" : "Sorpresas"}
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-wine-700 transition-colors hover:bg-blush-100"
    >
      <Gift className="size-5" aria-hidden />
      {unread > 0
        ? <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
        : unavailable && <span className="absolute right-0 top-0 size-2 rounded-full bg-danger-600" aria-hidden />}
    </Link>
  );
}
