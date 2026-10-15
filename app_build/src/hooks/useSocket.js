'use client';
// ============================================================
// CRIMESCOPE AI — WebSocket Hook
// ============================================================
// Locally the Express server on :3000 pushes events over Socket.io.
// On Vercel there is no long-lived socket server (Express runs inside the
// API functions), so unless NEXT_PUBLIC_SOCKET_URL points at one we fall
// back to polling /api/health for the LIVE badge and refreshing data on a
// timer.

import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import useIncidentStore from '@/stores/incidentStore';
import useAlertStore from '@/stores/alertStore';
import useAnalyticsStore from '@/stores/analyticsStore';
import useRealtimeStore from '@/stores/realtimeStore';

const HEALTH_POLL_MS = 20000;
const REFRESH_EVERY_N_POLLS = 3;

function socketUrl() {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
  return null;
}

export default function useSocket() {
  const socketRef = useRef(null);
  const addIncident = useIncidentStore(s => s.addIncident);
  const addAlert = useAlertStore(s => s.addAlert);
  const fetchOverview = useAnalyticsStore(s => s.fetchOverview);
  const { setConnected, setLastEvent } = useRealtimeStore();

  useEffect(() => {
    const url = socketUrl();

    if (!url) {
      let stopped = false;
      let polls = 0;
      const check = async () => {
        try {
          const res = await fetch('/api/health', { cache: 'no-store' });
          if (!stopped) setConnected(res.ok);
        } catch {
          if (!stopped) setConnected(false);
        }
        polls += 1;
        if (!stopped && polls % REFRESH_EVERY_N_POLLS === 0) fetchOverview();
      };
      check();
      const timer = setInterval(check, HEALTH_POLL_MS);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    }

    const socket = io(url, {
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
