import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import Splash from '@screens/Auth/Splash';
import Onboarding from '@screens/Auth/Onboarding';
import Login from '@screens/Auth/Login';
import Register from '@screens/Auth/Register';
import ForgotPassword from '@screens/Auth/ForgotPassword';

// Tab Navigators
import MainNavigator from './MainNavigator';
import SellerNavigator from './SellerNavigator';

// Store
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';

// UI Components
import TabBarIcon from '@components/ui/TabBarIcon';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Navigator
const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="Splash" component={Splash} />
    <Stack.Screen name="Onboarding" component={Onboarding} />
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="Register" component={Register} />
    <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
  </Stack.Navigator>
);

// Tab Navigator for Auth screens
const AuthTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        switch (route.name) {
          case 'Login':
            iconName = 'login';
            break;
          case 'Register':
            iconName = 'account-plus';
            break;
          default:
            iconName = 'help';
        }
        return <TabBarIcon name={iconName} focused={focused} color={color} size={size} />;
      },
      tabBarShowLabel: true,
      tabBarActiveTintColor: '#4C8BF5',
      tabBarInactiveTintColor: '#7A7A7A',
      tabBarStyle: {
        backgroundColor: '#F8F9FD',
        borderTopColor: '#E0E0E0',
        paddingTop: 5,
        paddingBottom: 5,
        height: 60,
      },
      headerShown: false,
    })}
  >
    <Tab.Screen
      name="Login"
      component={Login}
      options={{
        tabBarLabel: 'Login',
      }}
    />
    <Tab.Screen
      name="Register"
      component={Register}
      options={{
        tabBarLabel: 'Sign Up',
      }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, token, isLoading } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  // Show splash screen while loading
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={Splash} />
      </Stack.Navigator>
    );
  }

  // If user is authenticated and token exists
  if (user && token) {
    // Check if user is seller
    if (user.isSeller) {
      return <SellerNavigator />;
    } else {
      return <MainNavigator />;
    }
  }

  // User not authenticated - show auth screens
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
};

export default AppNavigator;