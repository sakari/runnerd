import { Run, Summary, Period } from "./types";

/** Get ISO week number for a date. */
function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Get the period label for a run's start date. */
export function periodLabel(startedAt: string, period: Period): string {
  const d = new Date(startedAt);
  const year = d.getFullYear();
  switch (period) {
    case "week": {
      const w = getWeek(d);
      return `${year}-W${String(w).padStart(2, "0")}`;
    }
    case "month":
      return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "year":
      return `${year}`;
  }
}

/** Aggregate runs into summaries for a given period. */
export function summarize(runs: Run[], period: Period): Summary[] {
  const map = new Map<string, Summary>();

  for (const run of runs) {
    const label = periodLabel(run.startedAt, period);
    const existing = map.get(label);
    if (existing) {
      existing.totalDistanceMeters += run.distanceMeters;
      existing.totalDurationSeconds += run.durationSeconds;
      existing.runCount += 1;
    } else {
      map.set(label, {
        period,
        label,
        totalDistanceMeters: run.distanceMeters,
        totalDurationSeconds: run.durationSeconds,
        runCount: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label));
}
