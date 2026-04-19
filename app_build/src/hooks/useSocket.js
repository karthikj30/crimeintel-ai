'use client';
// ============================================================
// CRIMESCOPE AI — WebSocket Hook
// ============================================================

import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import useIncidentStore from '@/stores/incidentStore';
import useAlertStore from '@/stores/alertStore';
import useAnalyticsStore from '@/stores/analyticsStore';
import useRealtimeStore from '@/stores/realtimeStore';

export default function useSocket() {
  const socketRef = useRef(null);
  const addIncident = useIncidentStore(s => s.addIncident);
  const addAlert = useAlertStore(s => s.addAlert);
  const fetchOverview = useAnalyticsStore(s => s.fetchOverview);
  const { setConnected, setLastEvent } = useRealtimeStore();

  useEffect(() => {
    const socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      connectTimeout: 3000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Connected to CrimeScope server');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from server');
      setConnected(false);
    });

    socket.on('incident:new', (incident) => {
      addIncident(incident);
      setLastEvent({ type: 'incident:new', data: incident, time: Date.now() });
    });

    socket.on('alert:new', (alert) => {
      addAlert(alert);
      setLastEvent({ type: 'alert:new', data: alert, time: Date.now() });
    });

    socket.on('analytics:refresh', () => {
      fetchOverview();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}
