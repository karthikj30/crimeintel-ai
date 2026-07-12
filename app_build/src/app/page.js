'use client';
// ============================================================
// CRIMESCOPE AI — Main Dashboard Page
// ============================================================

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AlertPanel from '@/components/layout/AlertPanel';
import BottomBar from '@/components/layout/BottomBar';
import useUIStore from '@/stores/uiStore';
import useSocket from '@/hooks/useSocket';

// Dynamic imports to avoid SSR issues with Leaflet
const KarnatakaMap = dynamic(() => import('@/components/map/KarnatakaMap'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const AnalyticsView = dynamic(() => import('@/components/analytics/AnalyticsView'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const AlertsView = dynamic(() => import('@/components/alerts/AlertsView'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const InvestigateView = dynamic(() => import('@/components/investigation/InvestigateView'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const AssistantView = dynamic(() => import('@/components/assistant/AssistantView'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const NetworkView = dynamic(() => import('@/components/network/NetworkView'), { ssr: false, loading: () => <LoadingPlaceholder /> });
const IntelView = dynamic(() => import('@/components/intel/IntelView'), { ssr: false, loading: () => <LoadingPlaceholder /> });

function LoadingPlaceholder() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
      <div>Loading...</div>
    </div>
  );
}

export default function Dashboard() {
  const activeView = useUIStore(s => s.activeView);
  const alertPanelOpen = useUIStore(s => s.alertPanelOpen);
  const [mounted, setMounted] = useState(false);

  // Connect WebSocket after mount
  useSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'assistant':
        return <AssistantView />;
      case 'intel':
        return <IntelView />;
      case 'network':
        return <NetworkView />;
      case 'map':
        return <KarnatakaMap />;
      case 'analytics':
        return <AnalyticsView />;
      case 'alerts':
        return <AlertsView />;
      case 'investigate':
        return <InvestigateView />;
      default:
        return <KarnatakaMap />;
    }
  };

  if (!mounted) {
    return <LoadingPlaceholder />;
  }

  const isAssistant = ['assistant', 'network', 'map', 'analytics', 'intel'].includes(activeView);

  return (
    <div className={`app-layout ${(!alertPanelOpen || isAssistant) ? 'alert-collapsed' : ''} ${isAssistant ? 'no-bottombar' : ''}`}>
      <Sidebar />
      <Header />
      <main className="main-content">
        {renderView()}
      </main>
      {!isAssistant && <AlertPanel />}
      {!isAssistant && <BottomBar />}
    </div>
  );
}
