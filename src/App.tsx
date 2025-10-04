import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  IonSplitPane,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonPage,
  IonList,
  IonItem,
  IonMenuToggle,
  IonIcon,
  IonLabel,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonRouterOutlet,
} from '@ionic/react';
import {
  homeOutline,
  medicalOutline,
  cubeOutline,
  calendarOutline,
  barChartOutline,
  settingsOutline,
  notificationsOutline,
  fileTrayFullOutline,
  bookOutline,
  personCircleOutline,
  pulseOutline,
} from 'ionicons/icons';
const Dashboard = React.lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Medications = React.lazy(() => import('@/pages/Medications').then(m => ({ default: m.Medications })));
const Inventory = React.lazy(() => import('@/pages/Inventory').then(m => ({ default: m.Inventory })));
const Calendar = React.lazy(() => import('@/pages/Calendar').then(m => ({ default: m.Calendar })));
const Analytics = React.lazy(() => import('@/pages/Analytics').then(m => ({ default: m.Analytics })));
const Settings = React.lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Reminders = React.lazy(() => import('@/pages/Reminders').then(m => ({ default: m.Reminders })));
const Reports = React.lazy(() => import('@/pages/Reports').then(m => ({ default: m.Reports })));
const HealthProfile = React.lazy(() => import('@/pages/HealthProfile').then(m => ({ default: m.HealthProfile })));
const Wiki = React.lazy(() => import('@/pages/Wiki').then(m => ({ default: m.Wiki })));
const CyclicDosing = React.lazy(() => import('@/pages/CyclicDosing').then(m => ({ default: m.CyclicDosing })));
const EffectsTracker = React.lazy(() => import('@/pages/EffectsTracker').then(m => ({ default: m.EffectsTracker })));
import { ChangelogModal } from '@/components/ui/ChangelogModal';
import { UpdateNotification, useUpdateNotification } from '@/components/ui/UpdateNotification';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
// import { AdminIntegration } from '@/components/admin/AdminIntegration'; // DISABLED
import { useMedicationStore } from '@/store';
import { notificationService } from '@/services/notificationService';
import { backendSyncService } from '@/services/backendSyncService';
import { backgroundStateService } from '@/services/backgroundStateService';
// import { liveActivityService } from '@/services/liveActivityService';
import { alertNotificationService } from '@/services/alertNotificationService';
import { consoleCapture } from '@/utils/consoleCapture';

function App() {
  // Always use Ionic UI (tabs-first IA)
  const { userProfile } = useMedicationStore();
  const { shouldShowChangelog, currentVersion, markVersionSeen } = useVersionCheck();
  const { showUpdate, showUpdateNotification, handleUpdate, handleDismiss } = useUpdateNotification();

  // Initialize notification handling
  // Initialize notification handling side effects
  useNotificationHandler();
  
  // Initialize alert notifications
  useAlertNotifications();

  // Initialize user profile if it doesn't exist
  React.useEffect(() => {
    if (!userProfile) {
      // We'll show a welcome screen or automatically create a basic profile
      // For now, let's create a default profile
    }
  }, [userProfile]);

  // Set up notification action event listeners
  React.useEffect(() => {
    const { logMedication, recordEffectFeedback, acknowledgePsychologicalAlert } = useMedicationStore.getState() as any;

    // Handle medication taken from notification
    const handleMedicationTaken = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.medicationId) {
        logMedication(detail.medicationId);
      }
    };

    // Handle alert acknowledgment
    const handleAlertAcknowledged = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.alertType === 'psychological' && detail.alertId) {
        acknowledgePsychologicalAlert(detail.alertId, 'helpful');
      }
    };

    // Handle alert dismissal
    const handleAlertDismissed = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.alertType === 'psychological' && detail.alertId) {
        acknowledgePsychologicalAlert(detail.alertId, 'dismissed');
      }
    };

    // Handle refill request from notification
    const handleRequestRefill = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.medicationId) {
        // Navigate to inventory page or show refill modal
        window.location.hash = '/inventory';
      }
    };

    // Handle inventory update from notification
    const handleUpdateInventory = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.medicationId) {
        window.location.hash = '/inventory';
      }
    };

    // Handle effect feedback from notification
    const handleEffectFeedback = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.logId && detail.status) {
        const session = (useMedicationStore.getState() as any).effectSessions.find((s: any) => s.id === detail.logId || s.medicationId === detail.medicationId);
        if (session) {
          recordEffectFeedback(session.id, detail.status);
        }
      }
    };

    // Handle take medication now from notification
    const handleTakeMedicationNow = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.medicationId) {
        logMedication(detail.medicationId);
      }
    };

    // Register all event listeners
    window.addEventListener('medicationTaken', handleMedicationTaken);
    window.addEventListener('alertAcknowledged', handleAlertAcknowledged);
    window.addEventListener('alertDismissed', handleAlertDismissed);
    window.addEventListener('requestRefill', handleRequestRefill);
    window.addEventListener('updateInventory', handleUpdateInventory);
    window.addEventListener('effectFeedback', handleEffectFeedback);
    window.addEventListener('takeMedicationNow', handleTakeMedicationNow);
    window.addEventListener('medicationAlreadyTaken', handleMedicationTaken);

    return () => {
      window.removeEventListener('medicationTaken', handleMedicationTaken);
      window.removeEventListener('alertAcknowledged', handleAlertAcknowledged);
      window.removeEventListener('alertDismissed', handleAlertDismissed);
      window.removeEventListener('requestRefill', handleRequestRefill);
      window.removeEventListener('updateInventory', handleUpdateInventory);
      window.removeEventListener('effectFeedback', handleEffectFeedback);
      window.removeEventListener('takeMedicationNow', handleTakeMedicationNow);
      window.removeEventListener('medicationAlreadyTaken', handleMedicationTaken);
    };
  }, []);

  // Restore effect sessions from background state on app load
  React.useEffect(() => {
    const restoreSessions = () => {
      const restoredSessions = backgroundStateService.restoreEffectSessions();
      if (restoredSessions.length > 0) {
        const { effectSessions } = useMedicationStore.getState();
        // Merge restored sessions with current sessions (avoid duplicates)
        const mergedSessions = [...effectSessions];
        restoredSessions.forEach(restored => {
          if (!mergedSessions.find(s => s.id === restored.id)) {
            mergedSessions.push(restored);
          }
        });
        
        // Update store with restored sessions
        useMedicationStore.setState({ effectSessions: mergedSessions });
        console.log(`✅ Restored ${restoredSessions.length} effect sessions from background state`);
      }
    };

    restoreSessions();
  }, []);

  // Check for missed notifications when the app loads
  React.useEffect(() => {
    const initializeApp = async () => {
      console.log('App loaded, initializing notification system...');
      
      // **CONSOLE CAPTURE**: Initialize global console capture for debugging
      // This persists across page navigation
      if (import.meta.env.DEV) {
        consoleCapture; // Initialize the singleton only in development
      }
      
      // Update last active timestamp
      backgroundStateService.updateLastActive();
      
      // Check for missed background tasks
      const timeSinceActive = backgroundStateService.getTimeSinceLastActive();
      console.log(`⏰ Time since last active: ${timeSinceActive} minutes`);
      
      // Run daily inventory check if needed (every 24 hours)
      if (backgroundStateService.shouldRunBackgroundTask('inventory_check', 24 * 60)) {
        const { medications, logs, userProfile } = useMedicationStore.getState();
        const alertPrefs = userProfile?.preferences?.alertNotifications;
        console.log('🔍 Running daily inventory check...');
        await alertNotificationService.checkAllInventoryAlerts(medications, logs, alertPrefs);
      }
      
      // Run daily adherence check if needed (every 24 hours)
      if (backgroundStateService.shouldRunBackgroundTask('adherence_check', 24 * 60)) {
        const { medications, generatePsychologicalSafetyAlerts } = useMedicationStore.getState();
        console.log('🔍 Running daily adherence check...');
        medications.filter(m => m.isActive).forEach(med => {
          generatePsychologicalSafetyAlerts(med.id);
        });
      }
      
      // Get current reminders and medications from store
      const { reminders, medications } = useMedicationStore.getState();
      
      // **BACKEND SYNC**: Initialize backend sync service for iOS PWA reliability
      try {
        console.log('🔄 Initializing backend sync service...');
        await backendSyncService.initialize();
        console.log('✅ Backend sync service initialized successfully');

        // Sync existing data to backend if available
        if (reminders.length > 0 || medications.length > 0) {
          console.log('📤 Syncing existing data to backend...');
          await backendSyncService.syncData({ reminders, medications, userProfile: useMedicationStore.getState().userProfile });
        }
      } catch (error) {
        console.error('❌ Backend sync initialization failed:', error);
        console.log('📱 Falling back to client-side notifications only');
      }

      // **iOS PWA FIX**: Migrate existing reminders to multi-instance system
      // Migration not supported in current notificationService; skip
      
      // **iOS PWA DIAGNOSTIC & RECOVERY**: Check for missed notifications and implement recovery
      console.log('Running iOS PWA notification diagnostic and recovery...');
      
      try {
        // Run standard missed notification check (public method exists)
        (notificationService as any).checkMissedNotifications?.();

        // Ensure backend is initialized after permissions/env become available, then sync
        try {
          await backendSyncService.initialize();
          if (backendSyncService.isReady()) {
            const state = (useMedicationStore as any).getState ? (useMedicationStore as any).getState() : null;
            const reminders = state?.reminders || [];
            const medications = state?.medications || [];
            const userProfile = state?.userProfile || null;
            console.log('📤 Syncing existing data to backend...');
            await backendSyncService.syncData({ reminders, medications, userProfile });
          }
        } catch (e) {
          // Non-fatal
        }
        
      } catch (error) {
        console.error('❌ Failed to run iOS PWA diagnostic:', error);
        // Fallback to standard check
        (notificationService as any).checkMissedNotifications?.();
      }
    };
    
    // Initialize after a short delay to ensure store is ready
    const timer = setTimeout(initializeApp, 1500);
    
    // Also check when the window gains focus
    const handleFocus = () => {
      console.log('Window gained focus, checking for missed notifications');
      (notificationService as any).checkMissedNotifications?.();
      // Re-attempt backend init and sync on focus (permissions may have changed)
      backendSyncService.initialize().then(async () => {
        if (backendSyncService.isReady()) {
          const state = (useMedicationStore as any).getState ? (useMedicationStore as any).getState() : null;
          const reminders = state?.reminders || [];
          const medications = state?.medications || [];
          const userProfile = state?.userProfile || null;
          await backendSyncService.syncData({ reminders, medications, userProfile });
        }
      });
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Expose the update notification to global scope for service worker integration
  React.useEffect(() => {
    (window as any).showAppUpdateNotification = (callback: () => void) => {
      showUpdateNotification(callback);
    };
    
    return () => {
      delete (window as any).showAppUpdateNotification;
    };
  }, [showUpdateNotification]);

  // Routes will render inside IonRouterOutlet to enable native transitions

  const primaryNav = [
    { name: 'Dashboard', href: '/dashboard', icon: homeOutline },
    { name: 'Medications', href: '/medications', icon: medicalOutline },
    { name: 'Inventory', href: '/inventory', icon: cubeOutline },
    { name: 'Calendar', href: '/calendar', icon: calendarOutline },
    { name: 'Analytics', href: '/analytics', icon: barChartOutline },
    { name: 'Settings', href: '/settings', icon: settingsOutline },
  ];
  const secondaryNav = [
    { name: 'Advanced Schedules', href: '/cyclic-dosing', icon: pulseOutline },
    { name: 'Effects Tracker', href: '/effects', icon: pulseOutline },
    { name: 'Wiki', href: '/wiki', icon: bookOutline },
    { name: 'Reminders', href: '/reminders', icon: notificationsOutline },
    { name: 'Reports', href: '/reports', icon: fileTrayFullOutline },
    { name: 'Health Profile', href: '/profile', icon: personCircleOutline },
  ];

  return (
    <IonSplitPane contentId="main">
      <IonMenu contentId="main">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Meditrax</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {primaryNav.map((item) => (
              <IonMenuToggle key={item.name} autoHide={true}>
                <IonItem button lines="none" detail={false} routerLink={item.href}>
                  <IonIcon slot="start" icon={item.icon} />
                  <IonLabel>{item.name}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            ))}
          </IonList>
          <IonList>
            {secondaryNav.map((item) => (
              <IonMenuToggle key={item.name} autoHide={true}>
                <IonItem button lines="none" detail={false} routerLink={item.href}>
                  <IonIcon slot="start" icon={item.icon} />
                  <IonLabel>{item.name}</IonLabel>
                </IonItem>
              </IonMenuToggle>
            ))}
          </IonList>
        </IonContent>
      </IonMenu>

      <IonPage id="main">
        <IonTabs>
          <IonRouterOutlet>
            <React.Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading…</div>}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/medications" element={<Medications />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/effects" element={<EffectsTracker />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/profile" element={<HealthProfile />} />
                <Route path="/wiki" element={<Wiki />} />
                <Route path="/cyclic-dosing" element={<CyclicDosing />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </React.Suspense>
          </IonRouterOutlet>

          <IonTabBar slot="bottom">
            <IonTabButton tab="dashboard" href="/dashboard">
              <IonIcon icon={homeOutline} />
              <IonLabel>Dashboard</IonLabel>
            </IonTabButton>
            <IonTabButton tab="medications" href="/medications">
              <IonIcon icon={medicalOutline} />
              <IonLabel>Medications</IonLabel>
            </IonTabButton>
            <IonTabButton tab="calendar" href="/calendar">
              <IonIcon icon={calendarOutline} />
              <IonLabel>Calendar</IonLabel>
            </IonTabButton>
            <IonTabButton tab="reminders" href="/reminders">
              <IonIcon icon={notificationsOutline} />
              <IonLabel>Reminders</IonLabel>
            </IonTabButton>
            <IonTabButton tab="settings" href="/settings">
              <IonIcon icon={settingsOutline} />
              <IonLabel>Settings</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>

        <UpdateNotification
          isVisible={showUpdate}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />

        <ChangelogModal
          isOpen={shouldShowChangelog}
          onClose={markVersionSeen}
          version={currentVersion}
        />
      </IonPage>
    </IonSplitPane>
  );
}

export default App;
