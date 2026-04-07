import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Run, Period, Summary } from "../core/types";
import { formatDuration, formatDistance, formatPace } from "../core/geo";
import { summarize } from "../core/summaries";
import { getAllRuns } from "../db/database";

const PERIODS: Period[] = ["week", "month", "year"];

export default function HistoryScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [period, setPeriod] = useState<Period>("week");
  const [showSummary, setShowSummary] = useState(true);

  useFocusEffect(
    useCallback(() => {
      getAllRuns().then(setRuns);
    }, []),
  );

  const summaries = summarize(runs, period);

  return (
    <View style={styles.container}>
      {/* Period toggle */}
      <View style={styles.toggleRow}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            style={[styles.toggle, period === p && styles.toggleActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {/* View toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, showSummary && styles.toggleActive]}
          onPress={() => setShowSummary(true)}
        >
          <Text style={[styles.toggleText, showSummary && styles.toggleTextActive]}>Summary</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, !showSummary && styles.toggleActive]}
          onPress={() => setShowSummary(false)}
        >
          <Text style={[styles.toggleText, !showSummary && styles.toggleTextActive]}>Runs</Text>
        </Pressable>
      </View>

      {showSummary ? (
        <FlatList
          data={summaries}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => <SummaryRow summary={item} />}
          ListEmptyComponent={<Text style={styles.empty}>No runs yet</Text>}
        />
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RunRow run={item} />}
          ListEmptyComponent={<Text style={styles.empty}>No runs yet</Text>}
        />
      )}
    </View>
  );
}

function SummaryRow({ summary }: { summary: Summary }) {
  const avgSpeedKmh =
    summary.totalDurationSeconds > 0
      ? summary.totalDistanceMeters / 1000 / (summary.totalDurationSeconds / 3600)
      : 0;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{summary.label}</Text>
      <Text style={styles.stat}>
        {summary.runCount} run{summary.runCount !== 1 ? "s" : ""}
      </Text>
      <Text style={styles.stat}>{formatDistance(summary.totalDistanceMeters)}</Text>
      <Text style={styles.stat}>{formatDuration(summary.totalDurationSeconds)}</Text>
      <Text style={styles.stat}>{avgSpeedKmh.toFixed(1)} km/h avg</Text>
    </View>
  );
}

function RunRow({ run }: { run: Run }) {
  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{dateStr}</Text>
      <Text style={styles.stat}>{formatDistance(run.distanceMeters)}</Text>
      <Text style={styles.stat}>{formatDuration(run.durationSeconds)}</Text>
      <Text style={styles.stat}>{formatPace(run.distanceMeters, run.durationSeconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 8,
  },
  toggle: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#222",
  },
  toggleActive: {
    backgroundColor: "#1a1",
  },
  toggleText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#fff",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  stat: {
    color: "#aaa",
    fontSize: 14,
  },
  empty: {
    color: "#666",
    textAlign: "center",
    marginTop: 48,
    fontSize: 16,
  },
});
