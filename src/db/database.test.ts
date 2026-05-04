import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecAsync, mockRunAsync, mockGetAllAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn(),
  mockRunAsync: vi.fn(),
  mockGetAllAsync: vi.fn(),
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn().mockResolvedValue({
    execAsync: mockExecAsync,
    runAsync: mockRunAsync,
    getAllAsync: mockGetAllAsync,
  }),
}));

import { getDb, insertRun, getAllRuns, updateRun, softDeleteRun, restoreRun } from "./database";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDb", () => {
  it("opens database and creates runs table", async () => {
    const db = await getDb();

    expect(db).toBeDefined();
    expect(mockExecAsync).toHaveBeenCalledTimes(2);
    expect(mockExecAsync.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS runs");
    expect(mockExecAsync.mock.calls[1][0]).toContain("ALTER TABLE runs ADD COLUMN deleted_at");
  });

  it("returns the same instance on subsequent calls", async () => {
    const db1 = await getDb();
    const db2 = await getDb();

    expect(db1).toBe(db2);
  });
});

describe("insertRun", () => {
  it("inserts a run and returns the id", async () => {
    mockRunAsync.mockResolvedValue({ lastInsertRowId: 42 });

    const id = await insertRun("2026-04-09T10:00:00Z", "2026-04-09T10:30:00Z", 5000, 1800);

    expect(id).toBe(42);
    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO runs"),
      "2026-04-09T10:00:00Z",
      "2026-04-09T10:30:00Z",
      5000,
      1800,
    );
  });
});

describe("getAllRuns", () => {
  it("returns runs mapped from database rows", async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        id: 1,
        started_at: "2026-04-09T10:00:00Z",
        finished_at: "2026-04-09T10:30:00Z",
        distance_meters: 5000,
        duration_seconds: 1800,
        deleted_at: null,
      },
    ]);

    const runs = await getAllRuns();

    expect(runs).toEqual([
      {
        id: 1,
        startedAt: "2026-04-09T10:00:00Z",
        finishedAt: "2026-04-09T10:30:00Z",
        distanceMeters: 5000,
        durationSeconds: 1800,
        deletedAt: null,
      },
    ]);
  });

  it("queries runs ordered by started_at DESC", async () => {
    mockGetAllAsync.mockResolvedValue([]);

    await getAllRuns();

    expect(mockGetAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY started_at DESC"),
    );
  });
});

describe("updateRun", () => {
  it("updates distance and duration for a run", async () => {
    mockRunAsync.mockResolvedValue({});

    await updateRun(1, 6000, 2000);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE runs SET"),
      6000,
      2000,
      1,
    );
  });

  it("updates started_at when provided", async () => {
    mockRunAsync.mockResolvedValue({});

    await updateRun(1, 6000, 2000, "2026-04-09T10:00:00.000Z");

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("started_at = ?"),
      6000,
      2000,
      "2026-04-09T10:00:00.000Z",
      1,
    );
  });
});

describe("softDeleteRun", () => {
  it("sets deleted_at timestamp for a run", async () => {
    mockRunAsync.mockResolvedValue({});

    await softDeleteRun(1);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE runs SET deleted_at"),
      expect.any(String),
      1,
    );
  });
});

describe("restoreRun", () => {
  it("clears deleted_at for a run", async () => {
    mockRunAsync.mockResolvedValue({});

    await restoreRun(1);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE runs SET deleted_at = NULL"),
      1,
    );
  });
});
