import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { GeoPoint, VoiceEvent } from "../core/types";
import { haversine, formatDuration, formatDistance, formatPace } from "../core/geo";
import { buildCallout, checkTriggers } from "../core/voice-triggers";
import { insertRun } from "../db/database";
import { startTracking, stopTracking } from "../platform/gps";
import { speak } from "../platform/speech";

export default function TimerScreen() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const firedRef = useRef<Set<VoiceEvent>>(new Set());
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  const lastPointRef = useRef<GeoPoint | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopTracking();
    deactivateKeepAwake();
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

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

    speak(buildCallout("start", 0, 0));
    firedRef.current.add("start");

    await startTracking((point) => {
      if (lastPointRef.current) {
        distanceRef.current += haversine(lastPointRef.current, point);
      }
      lastPointRef.current = point;
      setDistance(distanceRef.current);
    });
  }, [reset]);

  const handleStop = useCallback(async () => {
    cleanup();
    setRunning(false);

    const finalElapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
    const finalDistance = distanceRef.current;

    speak(buildCallout("finish", finalElapsed, finalDistance));

    const startedAt = startTimeRef.current
      ? new Date(startTimeRef.current).toISOString()
      : new Date().toISOString();

    await insertRun(startedAt, new Date().toISOString(), finalDistance, finalElapsed);
  }, [cleanup]);

  // Check voice triggers on distance change
  useEffect(() => {
    if (!running) return;
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
