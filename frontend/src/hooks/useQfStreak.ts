// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface QfStreak {
  days: number;
  longest: number | null;
}

export function useQfStreak(enabled: boolean) {
  const [data, setData] = useState<QfStreak | null>(null);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setLinked(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<QfStreak>("qf/me/streak")
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setLinked(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setLinked(false);
          return;
        }
        setLinked(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, loading, linked };
}
