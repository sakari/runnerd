import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { setupNotificationHandler } from "./src/platform/time-notifications";
import { configurePurchases } from "./src/platform/purchases";
import { REVENUECAT_TEST_KEY, apiKeyForBuild } from "./src/core/tips";
import TimerScreen from "./src/screens/TimerScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    // Only set up the handler at launch. Permission prompts are requested
    // in-context when the user first taps Start, per App Store guideline 5.1.1(ii).
    setupNotificationHandler();
    // apiKeyForBuild withholds the Test Store key from non-debug builds, where
    // the RevenueCat SDK would otherwise alert and crash on purpose. The tip UI
    // is therefore absent from a Release build until a real store key exists.
    configurePurchases(apiKeyForBuild(REVENUECAT_TEST_KEY, __DEV__), __DEV__);
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        detachInactiveScreens={false}
        screenOptions={{
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
          tabBarStyle: { backgroundColor: "#000", borderTopColor: "#333" },
          tabBarActiveTintColor: "#1a1",
          tabBarInactiveTintColor: "#888",
          freezeOnBlur: false,
        }}
      >
        <Tab.Screen
          name="Run"
          component={TimerScreen}
          options={{
            tabBarLabel: "Run",
            tabBarButtonTestID: "tab-run",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="footsteps" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarLabel: "History",
            tabBarButtonTestID: "tab-history",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
