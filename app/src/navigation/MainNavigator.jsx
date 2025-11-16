import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import HomeScreen from '@screens/Home/HomeScreen';
import SearchScreen from '@screens/Home/SearchScreen';
import CategoriesScreen from '@screens/Home/CategoriesScreen';
import MyOrdersScreen from '@screens/User/MyOrdersScreen';
import ChatListScreen from '@screens/Chat/ChatListScreen';
import ProfileScreen from '@screens/User/ProfileScreen';

// Store
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';

// UI Components
import TabBarIcon from '@components/ui/TabBarIcon';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HomeTabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarShowLabel: true,
      tabBarActiveTintColor: '#4C8BF5',
      tabBarInactiveTintColor: '#7A7A7A',
      tabBarStyle: {
        backgroundColor: '#F8F9FD',
        borderTopColor: '#E0E0E0',
        paddingTop: 5,
        paddingBottom: 5,
        height: 65,
      },
      headerShown: false,
      tabBarHideOnKeyboard: true,
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarLabel: 'Home',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="home" focused={focused} color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Categories"
      component={CategoriesScreen}
      options={{
        tabBarLabel: 'Categories',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="grid" focused={focused} color={color} size={size} />
        ),
      }}
    />
  </Tab.Navigator>
);

const MainNavigator = () => {
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        options={{ headerShown: false }}
      >
        <Stack.Screen
          name="HomeTab"
          component={HomeTabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={({ navigation }) => ({
            title: 'Search',
            headerStyle: {
              backgroundColor: '#F8F9FD',
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
            headerTintColor: '#1E1E1E',
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerLeft: () => null,
          })}
        />
      </Stack.Screen>

      <Stack.Screen
        name="Orders"
        component={MyOrdersScreen}
        options={({ navigation }) => ({
          title: 'My Orders',
          headerStyle: {
            backgroundColor: '#F8F9FD',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: '#1E1E1E',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerLeft: () => null,
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="clipboard-list" focused={focused} color={color} size={size} />
          ),
          tabBarLabel: 'Orders',
        })}
      />

      <Stack.Screen
        name="Chat"
        component={ChatListScreen}
        options={({ navigation }) => ({
          title: 'Messages',
          headerStyle: {
            backgroundColor: '#F8F9FD',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: '#1E1E1E',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerLeft: () => null,
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="message" focused={focused} color={color} size={size} />
          ),
          tabBarLabel: 'Chat',
          tabBarBadge: unreadCount > 0 ? `${unreadCount}` : null,
        })}
      />

      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Profile',
          headerStyle: {
            backgroundColor: '#F8F9FD',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTintColor: '#1E1E1E',
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerLeft: () => null,
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="account" focused={focused} color={color} size={size} />
          ),
          tabBarLabel: 'Profile',
        })}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;