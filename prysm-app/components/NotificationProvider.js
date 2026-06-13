'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [eventSource, setEventSource] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Function to add a notification
  const addNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    
    // Remove notification after 10 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);
  }, []);

  // Function to remove a notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Function to clear all notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Set up the event source for real-time updates
  useEffect(() => {
    // Only initialize EventSource on the client side
    if (typeof window === 'undefined') return;

    // Create a new EventSource to connect to our SSE endpoint
    const source = new EventSource('/api/token-updates');
    
    source.onopen = () => {
      console.log('Connected to token alert service');
      setIsConnected(true);
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_token') {
          // Add new token notification
          const notification = {
            id: `token-${data.token.id}`,
            type: 'new_token',
            title: `New Token: ${data.token.symbol}`,
            message: `${data.token.name} has been added to ICPSWAP`,
            timestamp: data.timestamp,
            token: data.token,
            read: false
          };
          
          addNotification(notification);
        } else if (data.type === 'connected') {
          console.log(data.message);
        } else if (data.type === 'error') {
          console.error('Error from server:', data.message);
        }
      } catch (error) {
        console.error('Error parsing event data:', error);
      }
    };

    source.onerror = (error) => {
      console.error('EventSource failed:', error);
      setIsConnected(false);
      source.close();
    };

    setEventSource(source);

    // Clean up on unmount
    return () => {
      if (source) {
        source.close();
      }
    };
  }, [addNotification]);

  const value = {
    notifications,
    isConnected,
    addNotification,
    removeNotification,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};