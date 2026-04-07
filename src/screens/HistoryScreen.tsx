import React, { useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, Modal, TextInput, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Run, Period, Summary } from "../core/types";
import { formatDuration, formatDistance, formatPace } from "../core/geo";
import { summarize } from "../core/summaries";
import { getAllRuns, deleteRun, updateRun } from "../db/database";

const PERIODS: Period[] = ["week", "month", "year"];

function parseDurationInput(text: string): number | null {
  const trimmed = text.trim();
  // H:MM:SS
  const hms = trimmed.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) {
    return parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10);
  }
  // MM:SS
  const ms = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (ms) {
    return parseInt(ms[1], 10) * 60 + parseInt(ms[2], 10);
  }
  return null;
}

function parseDistanceInput(text: string): number | null {
  const trimmed = text.trim().toLowerCase();
  // "1.5 km" or "1.5km"
  const km = trimmed.match(/^([\d.]+)\s*km$/);
  if (km) {
    const val = parseFloat(km[1]);
    return isNaN(val) ? null : val * 1000;
  }
  // "800 m" or "800m"
  const m = trimmed.match(/^([\d.]+)\s*m$/);
  if (m) {
    const val = parseFloat(m[1]);
    return isNaN(val) ? null : val;
  }
  // plain number — treat as km if >= a reasonable threshold, else meters
  const plain = parseFloat(trimmed);
  if (!isNaN(plain)) {
    // If user types e.g. "5.2" assume km; if "800" assume meters
    // Use a heuristic: values < 100 are km, >= 100 are meters
    return plain < 100 ? plain * 1000 : plain;
  }
  return null;
}

function formatDistanceForEdit(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [period, setPeriod] = useState<Period>("week");
  const [showSummary, setShowSummary] = useState(true);
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [editDuration, setEditDuration] = useState("");
  const [editDistance, setEditDistance] = useState("");

  const reload = useCallback(() => {
    getAllRuns().then(setRuns);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const openEdit = (run: Run) => {
    setEditingRun(run);
    setEditDuration(formatDuration(run.durationSeconds));
    setEditDistance(formatDistanceForEdit(run.distanceMeters));
  };

  const handleSave = async () => {
    if (!editingRun) return;
    const seconds = parseDurationInput(editDuration);
    if (seconds === null || seconds < 0) {
      Alert.alert("Invalid duration", "Use MM:SS or H:MM:SS format.");
      return;
    }
    const meters = parseDistanceInput(editDistance);
    if (meters === null || meters < 0) {
      Alert.alert("Invalid distance", 'Use a number with "km" or "m" (e.g. 5.2 km, 800 m).');
      return;
    }
    await updateRun(editingRun.id, meters, seconds);
    setEditingRun(null);
    reload();
  };

  const handleDelete = () => {
    if (!editingRun) return;
    Alert.alert("Delete run?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteRun(editingRun.id);
          setEditingRun(null);
          reload();
        },
      },
    ]);
  };

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
          renderItem={({ item }) => <RunRow run={item} onPress={() => openEdit(item)} />}
          ListEmptyComponent={<Text style={styles.empty}>No runs yet</Text>}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={editingRun !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Run</Text>

            <Text style={styles.inputLabel}>Duration (MM:SS or H:MM:SS)</Text>
            <TextInput
              style={styles.input}
              value={editDuration}
              onChangeText={setEditDuration}
              placeholder="25:30"
              placeholderTextColor="#555"
              keyboardType="default"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Distance (e.g. 5.2 km, 800 m)</Text>
            <TextInput
              style={styles.input}
              value={editDistance}
              onChangeText={setEditDistance}
              placeholder="5.00 km"
              placeholderTextColor="#555"
              keyboardType="default"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <Pressable style={styles.btnDelete} onPress={handleDelete}>
                <Text style={styles.btnDeleteText}>Delete</Text>
              </Pressable>
              <Pressable style={styles.btnCancel} onPress={() => setEditingRun(null)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnSave} onPress={handleSave}>
                <Text style={styles.btnSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

function RunRow({ run, onPress }: { run: Run; onPress: () => void }) {
  const date = new Date(run.startedAt);
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.label}>{dateStr}</Text>
      <Text style={styles.stat}>{formatDistance(run.distanceMeters)}</Text>
      <Text style={styles.stat}>{formatDuration(run.durationSeconds)}</Text>
      <Text style={styles.stat}>{formatPace(run.distanceMeters, run.durationSeconds)}</Text>
    </Pressable>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 360,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  inputLabel: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#2a2a2a",
    color: "#fff",
    fontSize: 16,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  btnDelete: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#300",
  },
  btnDeleteText: {
    color: "#f44",
    fontWeight: "600",
    fontSize: 15,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  btnCancelText: {
    color: "#aaa",
    fontWeight: "600",
    fontSize: 15,
  },
  btnSave: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1a1",
  },
  btnSaveText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
