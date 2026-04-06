import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { GeoPoint, VoiceEvent } from "../core/types";
import { totalDistance, formatDuration, formatDistance, formatPace } from "../core/geo";
import { buildCallout, checkTriggers } from "../core/voice-triggers";
import { insertRun } from "../db/database";
import { startTracking, stopTracking } from "../platform/gps";
import { speak } from "../platform/speech";

export default function TimerScreen() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const firedRef = useRef<Set<VoiceEvent>>(new Set());
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setDistance(0);
    setPoints([]);
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

    speak(buildCallout("start", 0, 0));
    firedRef.current.add("start");

    await startTracking((point) => {
      setPoints((prev) => {
        const next = [...prev, point];
        const d = totalDistance(next);
        setDistance(d);
        return next;
      });
    });
  }, [reset]);

  const handleStop = useCallback(async () => {
    stopTracking();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    deactivateKeepAwake();

    const finalElapsed = startTimeRef.current
      ? (Date.now() - startTimeRef.current) / 1000
      : elapsed;

    speak(buildCallout("finish", finalElapsed, distance));

    const startedAt = startTimeRef.current
      ? new Date(startTimeRef.current).toISOString()
      : new Date().toISOString();

    await insertRun(startedAt, new Date().toISOString(), distance, finalElapsed);
  }, [elapsed, distance]);

  // Check voice triggers on distance change
  useEffect(() => {
    if (!running) return;
    // For now, no target distance — halfway triggers can be added when user sets a target
    const events = checkTriggers(distance, null, firedRef.current);
    for (const e of events) {
      firedRef.current.add(e);
      speak(buildCallout(e, elapsed, distance));
    }
  }, [distance, running, elapsed]);

  return (
    <View style={styles.container}>
      <Text style={styles.time}>{formatDuration(elapsed)}</Text>
      <Text style={styles.distance}>{formatDistance(distance)}</Text>
      <Text style={styles.pace}>{formatPace(distance, elapsed)}</Text>

      <Pressable
        style={[styles.button, running ? styles.stopButton : styles.startButton]}
        onPress={running ? handleStop : handleStart}
      >
        <Text style={styles.buttonText}>{running ? "STOP" : "START"}</Text>
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
  distance: {
    fontSize: 36,
    color: "#0f0",
    marginTop: 8,
  },
  pace: {
    fontSize: 24,
    color: "#aaa",
    marginTop: 4,
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
  buttonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
});
