import * as Notifications from "expo-notifications";

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleTimeNotifications(
  targetDurationSeconds: number,
): Promise<void> {
  const halfway = Math.floor(targetDurationSeconds / 2);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Halfway",
      body: "You're halfway through your run",
      sound: "halfway.wav",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: halfway,
      repeats: false,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time's up",
      body: "You've reached your target time",
      sound: "times_up.wav",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: targetDurationSeconds,
      repeats: false,
    },
  });
}

export async function cancelTimeNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
