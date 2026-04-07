import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { requestPermissions } from "./src/platform/gps";
import TimerScreen from "./src/screens/TimerScreen";
import HistoryScreen from "./src/screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    requestPermissions();
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
          options={{ tabBarLabel: "Run" }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{ tabBarLabel: "History" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
