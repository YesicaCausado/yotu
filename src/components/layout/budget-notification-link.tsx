"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUser } from "@/lib/dal";

export function BudgetNotificationLink() {
  const [unread, setUnread] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async (userId: string) => {
    const { count, error } = await createClient()
      .from("appointment_budget_notifications")
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
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    getUser()
      .then((user) => {
        if (!active || !user) return;
        void refresh(user.id);
        supabase = createClient();
        channel = supabase
          .channel(`budget-notifications:${user.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "appointment_budget_notifications", filter: `recipient_id=eq.${user.id}` },
            () => { void refresh(user.id); },
          )
          .subscribe();
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return (
    <Link
      href="/citas"
      aria-label={unavailable ? "Avisos de presupuesto no disponibles" : `Avisos de presupuesto${unread ? `, ${unread} sin leer` : ""}`}
      title={unavailable ? "No se pudieron cargar los avisos" : "Avisos de presupuesto"}
      className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-wine-700 transition-colors hover:bg-blush-100"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      {unavailable && <span className="absolute right-0 top-0 size-2 rounded-full bg-danger-600" aria-hidden />}
    </Link>
  );
}
