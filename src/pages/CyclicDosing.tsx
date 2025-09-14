import React from 'react';
import { Calendar, Activity, TrendingDown, CheckCircle } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { CyclicDosingPattern, TaperingSchedule } from '@/types';
import toast from 'react-hot-toast';

export function CyclicDosing() {
  const { 
    medications, 
    addCyclicDosingPattern,
    addTaperingSchedule,
    updateMedication
  } = useMedicationStore();

  const [selectedMedication, setSelectedMedication] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<'patterns' | 'tapering' | 'active'>('active');
  const [customPatternName, setCustomPatternName] = React.useState<string>('');
  const [customStartDate, setCustomStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [customPhases, setCustomPhases] = React.useState<Array<{phase: string; duration: number; multiplier: number; message: string}>>([
    { phase: 'on', duration: 5, multiplier: 1.0, message: 'Take medication as prescribed' },
    { phase: 'off', duration: 2, multiplier: 0.0, message: 'Break period - no medication' }
  ]);

  // Check for URL parameters to pre-select medication
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const medicationParam = urlParams.get('medication');
    if (medicationParam && medications.find(m => m.id === medicationParam)) {
      setSelectedMedication(medicationParam);
      setActiveTab('patterns'); // Switch to patterns tab
    }
  }, [medications]);

  // Get medications with active cyclic dosing or tapering
  const activeCyclicMedications = medications.filter(med => 
    med.cyclicDosing?.isActive || med.tapering?.isActive
  );

  const handleCreateCustomPattern = (medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication || !customPatternName.trim()) return;

    const pattern: Omit<CyclicDosingPattern, 'id'> = {
      name: customPatternName.trim(),
      type: 'variable-dose',
      pattern: customPhases.map(phase => ({
        phase: phase.phase as any,
        duration: phase.duration,
        dosageMultiplier: phase.multiplier,
        customMessage: phase.message
      })),
      startDate: new Date(customStartDate),
      isActive: true,
      notes: `Custom pattern for ${medication.name}`
    };

    addCyclicDosingPattern(pattern);
    
    // Update medication to enable cyclic dosing - this will be handled by the store
    // updateMedication(medicationId, {
    //   cyclicDosing: pattern
    // });

    toast.success('Custom cyclic dosing pattern created');
    
    // Reset form
    setCustomPatternName('');
    setCustomPhases([
      { phase: 'on', duration: 5, multiplier: 1.0, message: 'Take medication as prescribed' },
      { phase: 'off', duration: 2, multiplier: 0.0, message: 'Break period - no medication' }
    ]);
  };

  const handleCreateCyclicPattern = (medicationId: string, patternType: 'on-off' | 'tapering' | 'variable') => {
    const medication = medications.find(m => m.id === medicationId);
    if (!medication) return;

    if (patternType === 'tapering') {
      // Create tapering schedule
      const taperingSchedule: Omit<TaperingSchedule, 'id'> = {
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        initialDose: parseFloat(medication.dosage),
        finalDose: parseFloat(medication.dosage) * 0.1, // 10% of initial
        taperingMethod: 'hyperbolic',
        customSteps: [],
        isActive: true
      };

      addTaperingSchedule(taperingSchedule);
      
      // Update medication to enable tapering - this will be handled by the store
      // updateMedication(medicationId, {
      //   tapering: taperingSchedule
      // });

      toast.success('Tapering schedule created');
    } else {
      // Create cyclic dosing pattern
      const pattern: Omit<CyclicDosingPattern, 'id'> = {
        name: `${patternType} pattern for ${medication.name}`,
        type: patternType === 'on-off' ? 'on-off-cycle' : 'variable-dose',
        pattern: patternType === 'on-off' ? [
          { phase: 'on', duration: 5, dosageMultiplier: 1.0, customMessage: 'Take medication as prescribed' },
          { phase: 'off', duration: 2, dosageMultiplier: 0.0, customMessage: 'Break period - no medication' }
        ] : [
          { phase: 'maintenance', duration: 5, dosageMultiplier: 1.0, customMessage: 'Weekday dose' },
          { phase: 'maintenance', duration: 2, dosageMultiplier: 0.5, customMessage: 'Weekend reduced dose' }
        ],
        startDate: new Date(),
        isActive: true,
        notes: `${patternType} cycling pattern for ${medication.name}`
      };

      addCyclicDosingPattern(pattern);
      
      // Update medication to enable cyclic dosing - this will be handled by the store
      // updateMedication(medicationId, {
      //   cyclicDosing: pattern
      // });

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
                        <p>Pattern: <span className="font-medium">{medication.cyclicDosing.name}</span></p>
                        <p>Type: <span className="font-medium">{medication.cyclicDosing.type}</span></p>
                        <p>Started: {medication.cyclicDosing.startDate.toLocaleDateString()}</p>
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
                        <p>Method: <span className="font-medium">{medication.tapering.taperingMethod}</span></p>
                        <p>Started: {medication.tapering.startDate.toLocaleDateString()}</p>
                        <p>Target End: {medication.tapering.endDate.toLocaleDateString()}</p>
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
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium text-gray-900 mb-4">Quick Setup Templates</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => handleCreateCyclicPattern(selectedMedication, 'on-off')}
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                      >
                        <Activity className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">On/Off Cycling</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Take for 5 days, break for 2 days
                        </p>
                      </button>

                      <button
                        onClick={() => handleCreateCyclicPattern(selectedMedication, 'variable')}
                        className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                      >
                        <Calendar className="h-6 w-6 text-green-500 mx-auto mb-2" />
                        <h4 className="font-medium text-gray-900">Variable Dosing</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Weekday full dose, weekend half dose
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

                  <div className="border-t pt-6">
                    <h3 className="text-md font-medium text-gray-900 mb-4">Custom Pattern Builder</h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pattern Name
                          </label>
                          <input
                            type="text"
                            value={customPatternName}
                            onChange={(e) => setCustomPatternName(e.target.value)}
                            placeholder="e.g., Weekend Break Pattern"
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pattern Phases
                        </label>
                        <div className="space-y-3">
                          {customPhases.map((phase, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Phase Name</label>
                                  <input
                                    type="text"
                                    value={phase.phase}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].phase = e.target.value;
                                      setCustomPhases(newPhases);
                                    }}
                                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Duration (days)</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={phase.duration}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].duration = parseInt(e.target.value) || 1;
                                      setCustomPhases(newPhases);
                                    }}
                                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Dose Multiplier</label>
                                  <select
                                    value={phase.multiplier}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].multiplier = parseFloat(e.target.value);
                                      setCustomPhases(newPhases);
                                    }}
                                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  >
                                    <option value={0}>0x (Skip)</option>
                                    <option value={0.25}>0.25x (Quarter)</option>
                                    <option value={0.5}>0.5x (Half)</option>
                                    <option value={0.75}>0.75x (Three quarters)</option>
                                    <option value={1}>1x (Full dose)</option>
                                    <option value={1.25}>1.25x</option>
                                    <option value={1.5}>1.5x</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
                                  <input
                                    type="text"
                                    value={phase.message}
                                    onChange={(e) => {
                                      const newPhases = [...customPhases];
                                      newPhases[index].message = e.target.value;
                                      setCustomPhases(newPhases);
                                    }}
                                    placeholder="Optional phase message"
                                    className="w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                              {customPhases.length > 1 && (
                                <button
                                  onClick={() => {
                                    const newPhases = customPhases.filter((_, i) => i !== index);
                                    setCustomPhases(newPhases);
                                  }}
                                  className="mt-2 text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove Phase
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setCustomPhases([...customPhases, { phase: 'phase', duration: 1, multiplier: 1.0, message: '' }])}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            + Add Phase
                          </button>
                          <button
                            onClick={() => handleCreateCustomPattern(selectedMedication)}
                            disabled={!customPatternName.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Create Custom Pattern
                          </button>
                        </div>
                      </div>
                    </div>
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
