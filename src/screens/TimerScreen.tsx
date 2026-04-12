import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, Dimensions, FlatList, StyleSheet } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { GeoPoint, TargetDurationMinutes } from "../core/types";
import { haversine, formatDuration, formatDistance, formatPace } from "../core/geo";

import { insertRun } from "../db/database";
import { startTracking, stopTracking } from "../platform/gps";
import { playCallout, preloadCallouts, unloadCallouts } from "../platform/speech";
import { scheduleTimeNotifications, cancelTimeNotifications } from "../platform/time-notifications";

const DURATIONS: (number | null)[] = [null, 15, 30, 45, 60, 75, 90, 105, 120];
const ITEM_WIDTH = 72;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SIDE_PADDING = (SCREEN_WIDTH - ITEM_WIDTH) / 2;

export default function TimerScreen() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [targetDuration, setTargetDuration] = useState<TargetDurationMinutes | null>(30);
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
    await cancelTimeNotifications();
    await unloadCallouts();
    deactivateKeepAwake();
  }, []);

  // Cleanup on unmount
  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup],
  );

  const reset = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setDistance(0);
    distanceRef.current = 0;
    lastPointRef.current = null;
    startTimeRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleStart = useCallback(async () => {
    reset();
    setRunning(true);
    startTimeRef.current = Date.now();
    await activateKeepAwakeAsync();
    await preloadCallouts();

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }
    }, 1000);

    playCallout("start");

    // Schedule time-based notifications (halfway, finish) via OS notifications
    // so they fire reliably even when backgrounded/locked
    const targetSec = targetDurationRef.current != null ? targetDurationRef.current * 60 : null;
    if (targetSec != null && targetSec > 0) {
      scheduleTimeNotifications(targetSec);
    }

    await startTracking((point) => {
      if (lastPointRef.current) {
        distanceRef.current += haversine(lastPointRef.current, point);
      }
      lastPointRef.current = point;
      setDistance(distanceRef.current);

      // Compute elapsed from wall clock — setInterval is suspended in background
      const currentElapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
      setElapsed(currentElapsed);
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

  const wheelRef = useRef<FlatList>(null);
  const [centeredIndex, setCenteredIndex] = useState(2);

  const handleScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
      const clamped = Math.max(0, Math.min(index, DURATIONS.length - 1));
      setCenteredIndex(clamped);
      setTargetDuration(DURATIONS[clamped]);
    },
    [],
  );

  const handleWheelItemPress = useCallback((index: number) => {
    wheelRef.current?.scrollToIndex({ index, animated: true });
    setCenteredIndex(index);
    setTargetDuration(DURATIONS[index]);
  }, []);

  return (
    <View style={styles.container}>
      {!running && (
        <View style={styles.durationSection}>
          <View style={styles.wheelContainer}>
            <View style={styles.wheelIndicator} />
            <FlatList
              ref={wheelRef}
              data={DURATIONS}
              keyExtractor={(_, i) => String(i)}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_WIDTH}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
              getItemLayout={(_, index) => ({
                length: ITEM_WIDTH,
                offset: ITEM_WIDTH * index,
                index,
              })}
              initialScrollIndex={centeredIndex}
              onMomentumScrollEnd={handleScrollEnd}
              extraData={centeredIndex}
              renderItem={({ item, index }) => {
                const dist = Math.abs(index - centeredIndex);
                return (
                  <Pressable style={styles.wheelItem} onPress={() => handleWheelItemPress(index)}>
                    <Text
                      style={[
                        styles.wheelText,
                        dist === 1 && styles.wheelTextNear,
                        dist === 0 && styles.wheelTextCenter,
                      ]}
                    >
                      {item == null ? "—" : `${item}`}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
          <Text style={[styles.targetLabel, targetDuration == null && styles.targetLabelDim]}>
            {targetDuration != null ? `${targetDuration} min target` : "no target"}
          </Text>
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
  wheelContainer: {
    height: 64,
    width: SCREEN_WIDTH,
  },
  wheelIndicator: {
    position: "absolute",
    left: SIDE_PADDING,
    width: ITEM_WIDTH,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(17, 170, 17, 0.15)",
    zIndex: 0,
  },
  wheelItem: {
    width: ITEM_WIDTH,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    color: "#444",
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  wheelTextNear: {
    color: "#888",
    fontSize: 22,
  },
  wheelTextCenter: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
  targetLabel: {
    color: "#1a1",
    fontSize: 14,
    marginTop: 8,
  },
  targetLabelDim: {
    color: "#555",
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
