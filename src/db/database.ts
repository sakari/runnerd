import * as SQLite from "expo-sqlite";
import { Run } from "../core/types";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("runnerd.db");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      distance_meters REAL NOT NULL DEFAULT 0,
      duration_seconds REAL NOT NULL DEFAULT 0
    );
  `);
  return db;
}

export async function insertRun(
  startedAt: string,
  finishedAt: string | null,
  distanceMeters: number,
  durationSeconds: number,
): Promise<number> {
  const d = await getDb();
  const result = await d.runAsync(
    "INSERT INTO runs (started_at, finished_at, distance_meters, duration_seconds) VALUES (?, ?, ?, ?)",
    startedAt,
    finishedAt,
    distanceMeters,
    durationSeconds,
  );
  return result.lastInsertRowId;
}

export async function getAllRuns(): Promise<Run[]> {
  const d = await getDb();
  const rows = await d.getAllAsync(
    "SELECT id, started_at, finished_at, distance_meters, duration_seconds FROM runs ORDER BY started_at DESC",
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    startedAt: r.started_at as string,
    finishedAt: r.finished_at as string | null,
    distanceMeters: r.distance_meters as number,
    durationSeconds: r.duration_seconds as number,
  }));
}

export async function updateRun(
  id: number,
  distanceMeters: number,
  durationSeconds: number,
): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    "UPDATE runs SET distance_meters = ?, duration_seconds = ? WHERE id = ?",
    distanceMeters,
    durationSeconds,
    id,
  );
}

export async function deleteRun(id: number): Promise<void> {
  const d = await getDb();
  await d.runAsync("DELETE FROM runs WHERE id = ?", id);
}
