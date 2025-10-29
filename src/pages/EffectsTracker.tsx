import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Clock } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { EffectTimer } from '@/components/ui/EffectTimer';
import { formatDate, getRelativeTime } from '@/utils/helpers';

export function EffectsTracker() {
  const medications = useMedicationStore(s => s.medications);
  const activeMedications = medications.filter(m => m.isActive);
  const effectSessions = useMedicationStore(s => s.effectSessions);
  const getActiveEffectSessionForMedication = useMedicationStore(s => s.getActiveEffectSessionForMedication);

  const activeSessions = effectSessions.filter(s => !s.endTime);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mobile-title text-gray-900 flex items-center gap-2"><Brain className="h-6 w-6 text-purple-600" /> Effects Tracker</h1>
              <p className="mobile-text text-gray-500 mt-1">Track onset, peak, and wear-off for your medications. The system learns your metabolism from your feedback.</p>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Clock className="h-5 w-5 text-blue-600 mr-2" /> Active Sessions
                </h3>
                <span className="badge badge-primary">{activeSessions.length}</span>
              </div>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeSessions.map(session => (
                  <div key={session.id} className="space-y-2">
                    <EffectTimer medicationId={session.medicationId} />
                    <div className="text-xs text-gray-500">Started {getRelativeTime(new Date(session.startTime))} • {formatDate(new Date(session.startTime), 'MMM d, h:mm a')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Active Medications */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Active Medications</h3>
              <Link to="/medications" className="text-sm text-primary-600 hover:text-primary-700">Manage</Link>
            </div>
          </div>
          <div className="card-content">
            {activeMedications.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600">No active medications. Add a medication to start tracking effects.</p>
                <div className="mt-3">
                  <Link to="/medications" className="btn-primary">Add Medication</Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeMedications.map(med => (
                  <EffectTimer key={med.id} medicationId={med.id} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sessions (ended) */}
        {effectSessions.filter(s => !!s.endTime).length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Recent Sessions</h3>
            </div>
            <div className="card-content">
              <div className="space-y-2">
                {effectSessions
                  .filter(s => !!s.endTime)
                  .slice(-5)
                  .reverse()
                  .map(s => {
                    const med = medications.find(m => m.id === s.medicationId);
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: med?.color }} />
                          <span className="text-sm text-gray-900">{med?.name || 'Unknown medication'}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(new Date(s.startTime), 'MMM d, h:mm a')} – {formatDate(new Date(s.endTime as Date), 'h:mm a')}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default EffectsTracker;


