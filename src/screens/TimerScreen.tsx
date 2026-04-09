import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { GeoPoint, VoiceEvent, TargetDurationMinutes } from "../core/types";
import { haversine, formatDuration, formatDistance, formatPace } from "../core/geo";
import { checkTriggers } from "../core/voice-triggers";
import { insertRun } from "../db/database";
import { startTracking, stopTracking } from "../platform/gps";
import { playCallout } from "../platform/speech";

export default function TimerScreen() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [targetDuration, setTargetDuration] = useState<TargetDurationMinutes | null>(null);
  const firedRef = useRef<Set<VoiceEvent>>(new Set());
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const targetDurationRef = useRef<TargetDurationMinutes | null>(null);

  const cleanup = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await stopTracking();
    deactivateKeepAwake();
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { cleanup(); }, [cleanup]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setDistance(0);
    distanceRef.current = 0;
    lastPointRef.current = null;
    firedRef.current = new Set();
    startTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleStart = useCallback(async () => {
    reset();
    setRunning(true);
    startTimeRef.current = Date.now();
    await activateKeepAwakeAsync();

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }
    }, 1000);

    playCallout("start");
    firedRef.current.add("start");

    await startTracking((point) => {
      if (lastPointRef.current) {
        distanceRef.current += haversine(lastPointRef.current, point);
      }
      lastPointRef.current = point;
      setDistance(distanceRef.current);

      // Compute elapsed from wall clock — setInterval is suspended in background
      const currentElapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      setElapsed(currentElapsed);

      // Check voice triggers directly in the GPS callback so they fire
      // even when the app is backgrounded (React effects don't run in background)
      const targetSec = targetDurationRef.current != null ? targetDurationRef.current * 60 : null;
      const events = checkTriggers(
        distanceRef.current,
        null,
        firedRef.current,
        currentElapsed,
        targetSec,
      );
      for (const e of events) {
        firedRef.current.add(e);
        playCallout(e);
      }
    });
  }, [reset]);

  const handleStop = useCallback(async () => {
    cleanup();
    setRunning(false);

    const finalElapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
    const finalDistance = distanceRef.current;

    playCallout("finish");

    const startedAt = startTimeRef.current
      ? new Date(startTimeRef.current).toISOString()
      : new Date().toISOString();

    await insertRun(startedAt, new Date().toISOString(), finalDistance, finalElapsed);
  }, [cleanup]);

  const targetSeconds = targetDuration != null ? targetDuration * 60 : null;
  const remaining = targetSeconds != null ? Math.max(0, targetSeconds - elapsed) : null;

  // Keep targetDurationRef in sync so the GPS callback can access it
  useEffect(() => {
    targetDurationRef.current = targetDuration;
  }, [targetDuration]);

  const [customInput, setCustomInput] = useState("");
  const presets = [30, 60];

  const selectPreset = (d: number) => {
    if (targetDuration === d) {
      setTargetDuration(null);
      setCustomInput("");
    } else {
      setTargetDuration(d);
      setCustomInput("");
    }
  };

  const applyCustom = () => {
    const mins = parseFloat(customInput);
    if (!isNaN(mins) && mins > 0) {
      setTargetDuration(mins);
    }
  };

  return (
    <View style={styles.container}>
      {!running && (
        <View style={styles.durationSection}>
          <View style={styles.durationRow}>
            {presets.map((d) => (
              <Pressable
                key={d}
                style={[styles.durationChip, targetDuration === d && styles.durationChipActive]}
                onPress={() => selectPreset(d)}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    targetDuration === d && styles.durationChipTextActive,
                  ]}
                >
                  {d}m
                </Text>
              </Pressable>
            ))}
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                value={customInput}
                onChangeText={(text) => {
                  setCustomInput(text);
                  setTargetDuration(null);
                }}
                onSubmitEditing={applyCustom}
                placeholder="min"
                placeholderTextColor="#555"
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Pressable
                style={[styles.durationChip, styles.customApply]}
                onPress={applyCustom}
                disabled={!customInput}
              >
                <Ionicons name="checkmark" size={18} color={customInput ? "#fff" : "#555"} />
              </Pressable>
            </View>
          </View>
          {targetDuration != null && (
            <Text style={styles.targetLabel}>{targetDuration} min target</Text>
          )}
        </View>
      )}

      <Text style={styles.time}>{formatDuration(elapsed)}</Text>
      {running && remaining != null && (
        <Text style={styles.remaining}>
          <Ionicons name="hourglass-outline" size={16} color="#ff0" /> {formatDuration(remaining)}{" "}
          left
        </Text>
      )}
      <View style={styles.statRow}>
        <Ionicons name="map-outline" size={20} color="#0f0" />
        <Text style={styles.distance}>{formatDistance(distance)}</Text>
      </View>
      <View style={styles.statRow}>
        <Ionicons name="speedometer-outline" size={18} color="#aaa" />
        <Text style={styles.pace}>{formatPace(distance, elapsed)}</Text>
      </View>

      <Pressable
        style={[styles.button, running ? styles.stopButton : styles.startButton]}
        onPress={running ? handleStop : handleStart}
      >
        <Ionicons
          name={running ? "stop" : "play"}
          size={40}
          color="#fff"
          style={!running && styles.playIcon}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  time: {
    fontSize: 72,
    fontWeight: "200",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  distance: {
    fontSize: 36,
    color: "#0f0",
  },
  remaining: {
    fontSize: 20,
    color: "#ff0",
    marginTop: 2,
  },
  pace: {
    fontSize: 24,
    color: "#aaa",
  },
  playIcon: {
    marginLeft: 4,
  },
  durationSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  customInput: {
    width: 60,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#555",
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  customApply: {
    borderColor: "#555",
    paddingHorizontal: 10,
  },
  targetLabel: {
    color: "#1a1",
    fontSize: 14,
    marginTop: 8,
  },
  durationChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#555",
  },
  durationChipActive: {
    backgroundColor: "#1a1",
    borderColor: "#1a1",
  },
  durationChipText: {
    fontSize: 18,
    color: "#aaa",
    fontWeight: "600",
  },
  durationChipTextActive: {
    color: "#fff",
  },
  button: {
    marginTop: 48,
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#1a1",
  },
  stopButton: {
    backgroundColor: "#c00",
  },
});
