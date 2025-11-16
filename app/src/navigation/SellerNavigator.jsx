import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import SellerOrdersScreen from '@screens/Seller/SellerOrdersScreen';
import ManageServicesScreen from '@screens/Seller/ManageServicesScreen';
import CreateServiceScreen from '@screens/Seller/CreateServiceScreen';
import EarningsScreen from '@screens/Seller/EarningsScreen';
import ProfileScreen from '@screens/User/ProfileScreen';

// Store
import { useAuthStore } from '@store/authStore';
import { useNotificationStore } from '@store/notificationStore';

// UI Components
import TabBarIcon from '@components/ui/TabBarIcon';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const SellerTabNavigator = () => (
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
      name="SellerOrders"
      component={SellerOrdersScreen}
      options={{
        tabBarLabel: 'Orders',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="clipboard-list" focused={focused} color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Services"
      component={ManageServicesScreen}
      options={{
        tabBarLabel: 'Services',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="folder" focused={focused} color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="CreateService"
      component={CreateServiceScreen}
      options={{
        tabBarLabel: 'Create',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="plus-circle" focused={focused} color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="Earnings"
      component={EarningsScreen}
      options={{
        tabBarLabel: 'Earnings',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="cash" focused={focused} color={color} size={size} />
        ),
      }}
    />
    <Tab.Screen
      name="SellerProfile"
      component={ProfileScreen}
      options={{
        tabBarLabel: 'Profile',
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon name="account" focused={focused} color={color} size={size} />
        ),
      }}
    />
  </Tab.Navigator>
);

const SellerNavigator = () => {
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SellerTabs"
        options={{ headerShown: false }}
      >
        <Stack.Screen
          name="SellerDashboard"
          component={SellerTabNavigator}
          options={{ headerShown: false }}
        />
      </Stack.Screen>

      {/* Stack screens that need header */}
      <Stack.Screen
        name="OrderDetails"
        component={SellerOrdersScreen}
        options={{
          title: 'Order Details',
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
        }}
      />

      <Stack.Screen
        name="CreateServiceFull"
        component={CreateServiceScreen}
        options={{
          title: 'Create Service',
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
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="EditService"
        component={ManageServicesScreen}
        options={{
          title: 'Edit Service',
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
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="Withdrawal"
        component={EarningsScreen}
        options={{
          title: 'Withdraw Money',
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
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="SellerProfileFull"
        component={ProfileScreen}
        options={{
          title: 'Seller Profile',
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
        }}
      />
    </Stack.Navigator>
  );
};

export default SellerNavigator;