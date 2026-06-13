/**
 * Live Region Announcer
 * Announces dynamic content changes to screen readers
 * Improves accessibility for assistive technology users
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AnnouncerContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | undefined>(undefined);

export function useAnnouncer() {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error('useAnnouncer must be used within AnnouncerProvider');
  }
  return context;
}

interface AnnouncerProviderProps {
  children: React.ReactNode;
}

export function AnnouncerProvider({ children }: AnnouncerProviderProps) {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = (newMessage: string, newPriority: 'polite' | 'assertive' = 'polite') => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear current message first for immediate screen reader feedback
    setMessage('');
    setPriority(newPriority);

    // Small delay to ensure screen reader picks up the change
    timeoutRef.current = setTimeout(() => {
      setMessage(newMessage);
    }, 100);

    // Clear message after 5 seconds to avoid overwhelming screen readers
    timeoutRef.current = setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Live region for screen reader announcements */}
      <div
        aria-live={priority}
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}
