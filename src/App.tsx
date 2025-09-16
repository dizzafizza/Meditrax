import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Medications } from '@/pages/Medications';
import { Inventory } from '@/pages/Inventory';
import { Calendar } from '@/pages/Calendar';
import { Analytics } from '@/pages/Analytics';
import { Settings } from '@/pages/Settings';
import { Reminders } from '@/pages/Reminders';
import { Reports } from '@/pages/Reports';
import { HealthProfile } from '@/pages/HealthProfile';
import { Wiki } from '@/pages/Wiki';
import { CyclicDosing } from '@/pages/CyclicDosing';
import { ChangelogModal } from '@/components/ui/ChangelogModal';
import { useVersionCheck } from '@/hooks/useVersionCheck';
// import { AdminIntegration } from '@/components/admin/AdminIntegration'; // DISABLED
import { useMedicationStore } from '@/store';

function App() {
  const { userProfile } = useMedicationStore();
  const { shouldShowChangelog, currentVersion, markVersionSeen } = useVersionCheck();

  // Initialize user profile if it doesn't exist
  React.useEffect(() => {
    if (!userProfile) {
      // We'll show a welcome screen or automatically create a basic profile
      // For now, let's create a default profile
    }
  }, [userProfile]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/medications" element={<Medications />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/profile" element={<HealthProfile />} />
          <Route path="/wiki" element={<Wiki />} />
          <Route path="/cyclic-dosing" element={<CyclicDosing />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
      
      {/* Hidden Admin Integration - tracks UI sequences for admin access */}
      {/* <AdminIntegration /> */}
      
      {/* Changelog Modal */}
      <ChangelogModal
        isOpen={shouldShowChangelog}
        onClose={markVersionSeen}
        version={currentVersion}
      />
    </div>
  );
}

export default App;
