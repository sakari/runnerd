import * as Notifications from "expo-notifications";

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleTimeNotifications(targetDurationSeconds: number): Promise<void> {
  const halfway = Math.floor(targetDurationSeconds / 2);

  await Notifications.scheduleNotificationAsync({
    identifier: "run-halfway",
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
    identifier: "run-finish",
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
  await Notifications.dismissNotificationAsync("run-halfway");
  await Notifications.dismissNotificationAsync("run-finish");
}

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const id = notification.request.identifier;
      // When finish fires, dismiss the halfway notification
      if (id === "run-finish") {
        await Notifications.dismissNotificationAsync("run-halfway");
      }
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}
