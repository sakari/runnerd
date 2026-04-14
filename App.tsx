import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { setupNotificationHandler } from "./src/platform/time-notifications";
import TimerScreen from "./src/screens/TimerScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    // Only set up the handler at launch. Permission prompts are requested
    // in-context when the user first taps Start, per App Store guideline 5.1.1(ii).
    setupNotificationHandler();
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
            tabBarTestID: "tab-run",
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
            tabBarTestID: "tab-history",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
