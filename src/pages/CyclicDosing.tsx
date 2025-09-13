import React from 'react';
import { Calendar, Activity, Clock, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, CyclicDosingPattern, TaperingSchedule } from '@/types';
import toast from 'react-hot-toast';

export function CyclicDosing() {
  const { 
    medications, 
    addCyclicDosingPattern,
    updateCyclicDosingPattern,
    deleteCyclicDosingPattern,
    cyclicDosingPatterns,
    addTaperingSchedule,
    updateTaperingSchedule,
    taperingSchedules,
    updateMedication
  } = useMedicationStore();

  const [selectedMedication, setSelectedMedication] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<'patterns' | 'tapering' | 'active'>('active');

  // Get medications with active cyclic dosing or tapering
  const activeCyclicMedications = medications.filter(med => 
    med.cyclicDosing?.isActive || med.tapering?.isActive
  );

  const handleCreateCyclicPattern = (medicationId: string, patternType: 'on-off' | 'tapering' | 'variable') => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    if (patternType === 'tapering') {
      // Create tapering schedule
      const taperingSchedule: Omit<TaperingSchedule, 'id'> = {
        medicationId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        initialDose: parseFloat(medication.dosage),
        finalDose: parseFloat(medication.dosage) * 0.1, // 10% of initial
        method: 'hyperbolic',
        isActive: true,
        steps: [],
        currentStep: 0
      };

      addTaperingSchedule(taperingSchedule);
      
      // Update medication to enable tapering
      updateMedication(medicationId, {
        tapering: {
          isActive: true,
          scheduleId: 'temp-id', // Will be updated with actual ID
          currentPhase: 'reduction',
          nextReductionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      toast.success('Tapering schedule created');
    } else {
      // Create cyclic dosing pattern
      const pattern: Omit<CyclicDosingPattern, 'id'> = {
        medicationId,
        type: patternType,
        schedule: patternType === 'on-off' ? {
          onDays: 5,
          offDays: 2,
          currentPhase: 'on',
          phaseStartDate: new Date(),
          cycleCount: 0
        } : {
          patterns: [
            { day: 'weekday', multiplier: 1.0 },
            { day: 'weekend', multiplier: 0.5 }
          ],
          currentMultiplier: 1.0
        },
        isActive: true,
        startDate: new Date(),
        notes: `${patternType} cycling pattern for ${medication.name}`
      };

      addCyclicDosingPattern(pattern);
      
      // Update medication to enable cyclic dosing
      updateMedication(medicationId, {
        cyclicDosing: {
          isActive: true,
          patternId: 'temp-id', // Will be updated with actual ID
          currentPhase: 'on',
          nextTransition: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        }
      });

      toast.success('Cyclic dosing pattern created');
    }
  };

  const handleStopPattern = (medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    // Disable cyclic dosing and tapering
    updateMedication(medicationId, {
      cyclicDosing: undefined,
      tapering: undefined
    });

    toast.success('Cycling pattern stopped');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-gray-200">
        <div className="flex items-center mb-4">
          <Activity className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cyclic Dosing & Tapering</h1>
            <p className="text-gray-600">Manage complex medication schedules and withdrawal protocols</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Cyclic Patterns</h3>
            </div>
            <p className="text-sm text-gray-600">On/off cycles, variable dosing, holiday schedules</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold text-gray-900">Tapering Schedules</h3>
            </div>
            <p className="text-sm text-gray-600">Gradual dose reduction with medical supervision</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-gray-900">Smart Monitoring</h3>
            </div>
            <p className="text-sm text-gray-600">Withdrawal tracking and safety alerts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'active', name: 'Active Schedules', icon: Activity },
            { id: 'patterns', name: 'Create Pattern', icon: Calendar },
            { id: 'tapering', name: 'Tapering Plans', icon: TrendingDown }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Active Schedules */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Cyclic Dosing & Tapering</h2>
          
          {activeCyclicMedications.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No active schedules</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create cyclic dosing patterns or tapering schedules to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCyclicMedications.map((medication) => (
                <div key={medication.id} className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{medication.name}</h3>
                      <p className="text-sm text-gray-500">{medication.dosage} {medication.unit}</p>
                    </div>
                    <button
                      onClick={() => handleStopPattern(medication.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Stop
                    </button>
                  </div>

                  {medication.cyclicDosing?.isActive && (
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">Cyclic Dosing</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Current Phase: <span className="font-medium">{medication.cyclicDosing.currentPhase}</span></p>
                        {medication.cyclicDosing.nextTransition && (
                          <p>Next Transition: {medication.cyclicDosing.nextTransition.toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {medication.tapering?.isActive && (
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium text-gray-700">Tapering Schedule</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Current Phase: <span className="font-medium">{medication.tapering.currentPhase}</span></p>
                        {medication.tapering.nextReductionDate && (
                          <p>Next Reduction: {medication.tapering.nextReductionDate.toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Pattern */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Create Cyclic Dosing Pattern</h2>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Medication
                </label>
                <select
                  value={selectedMedication}
                  onChange={(e) => setSelectedMedication(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Choose a medication...</option>
                  {medications.filter(med => med.isActive && !med.cyclicDosing?.isActive && !med.tapering?.isActive).map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name} ({med.dosage} {med.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMedication && (
                <div className="space-y-4">
                  <h3 className="text-md font-medium text-gray-900">Select Pattern Type</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleCreateCyclicPattern(selectedMedication, 'on-off')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Activity className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                      <h4 className="font-medium text-gray-900">On/Off Cycling</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Take for X days, break for Y days
                      </p>
                    </button>

                    <button
                      onClick={() => handleCreateCyclicPattern(selectedMedication, 'variable')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <Calendar className="h-6 w-6 text-green-500 mx-auto mb-2" />
                      <h4 className="font-medium text-gray-900">Variable Dosing</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Different doses on different days
                      </p>
                    </button>

                    <button
                      onClick={() => handleCreateCyclicPattern(selectedMedication, 'tapering')}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      <TrendingDown className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                      <h4 className="font-medium text-gray-900">Tapering Schedule</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Gradual dose reduction
                      </p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tapering Plans */}
      {activeTab === 'tapering' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Tapering Plans</h2>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-center py-8">
              <TrendingDown className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Advanced Tapering Plans</h3>
              <p className="mt-1 text-sm text-gray-500">
                Detailed tapering schedule management is available through the Medications page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
