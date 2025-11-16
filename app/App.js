import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Platform } from 'react-native';

// Navigation
import AppNavigator from '@navigation/AppNavigator';

// Store
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';

// Services
import { notificationService } from '@services/notificationService';
import { socketService } from '@services/socketService';

// Theme
import { PaperProvider } from 'react-native-paper';
import { MD3LightTheme } from 'react-native-paper';

const App = () => {
  const [appIsReady, setAppIsReady] = useState(false);
  const { user, token, initializeAuth } = useAuthStore();
  const { initializeNotifications } = useNotificationStore();

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        // Initialize authentication
        await initializeAuth();

        // Initialize notifications
        await initializeNotifications();

        // Setup socket connection
        if (token && user) {
          socketService.connect(token);
          notificationService.initialize();
        }

        setAppIsReady(true);
      } catch (error) {
        console.error('App initialization error:', error);
      }
    };

    initApp();
  }, []);

  // Handle socket reconnection
  useEffect(() => {
    if (token && user && appIsReady) {
      socketService.connect(token);
      socketService.onConnect(() => {
        console.log('Socket connected');
        socketService.joinUserRoom(user._id);
      });

      socketService.onDisconnect(() => {
        console.log('Socket disconnected');
      });
    }
  }, [token, user, appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ flex: 1 }}>
        <PaperProvider theme={MD3LightTheme}>
          <NavigationContainer>
            <StatusBar
              style={Platform.OS === 'android' ? 'light' : 'dark'}
              backgroundColor="#4C8BF5"
              barStyle={Platform.OS === 'android' ? 'light-content' : 'default'}
            />
            <AppNavigator />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;