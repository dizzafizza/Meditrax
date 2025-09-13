import React from 'react';
import { Check, X, Pill } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, PillLogEntry } from '@/types';
import { getPillComponents } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface MultiplePillQuickLogProps {
  medication: Medication;
  onAction?: (action: 'taken' | 'skipped' | 'partial') => void;
}

export function MultiplePillQuickLog({ medication, onAction }: MultiplePillQuickLogProps) {
  const { logMultiplePillDose } = useMedicationStore();
  const [pillsTaken, setPillsTaken] = React.useState<Record<string, number>>({});
  const [isLogging, setIsLogging] = React.useState(false);

  const pillComponents = React.useMemo(() => {
    // Return empty array if not supporting multiple pills
    if (!medication.useMultiplePills || !medication.pillConfigurations || !medication.doseConfigurations) {
      return [];
    }
    const components = getPillComponents(medication);
    console.log(`🔍 MultiplePillQuickLog getPillComponents for ${medication.name}:`, components);
    return components;
  }, [
    medication.useMultiplePills,
    medication.pillConfigurations,
    medication.doseConfigurations,
    medication.defaultDoseConfigurationId
  ]);

  // Create a stable key from medication configuration for useEffect dependency
  const configurationKey = React.useMemo(() => {
    if (pillComponents.length === 0) return 'no-pills';
    
    return pillComponents
      .map(comp => comp.pillConfigurationId)
      .sort()
      .join('-');
  }, [medication.id, medication.defaultDoseConfigurationId]);

  // Initialize pills taken state - only when configuration actually changes
  React.useEffect(() => {
    if (pillComponents.length === 0) return;
    
    const initialState: Record<string, number> = {};
    pillComponents.forEach(component => {
      initialState[component.pillConfigurationId] = 0;
    });
    setPillsTaken(initialState);
  }, [configurationKey]); // Use stable configuration key

  const handlePillCountChange = (pillConfigId: string, change: number) => {
    setPillsTaken(prev => ({
      ...prev,
      [pillConfigId]: Math.max(0, (prev[pillConfigId] || 0) + change)
    }));
  };

  const handleLogDose = async () => {
    setIsLogging(true);
    try {
      const pillLogs: PillLogEntry[] = pillComponents.map(component => ({
        pillConfigurationId: component.pillConfigurationId,
        quantityTaken: pillsTaken[component.pillConfigurationId] || 0,
        quantityExpected: component.quantity,
        timeTaken: new Date(),
      }));

      console.log('🔄 Logging multiple pill dose:', medication.name, {
        pillLogs,
        pillComponents,
        pillsTaken,
        inventoryCount: medication.pillInventory?.length || 0
      });

      logMultiplePillDose(medication.id, pillLogs);

      const totalExpected = pillComponents.reduce((sum, comp) => sum + comp.quantity, 0);
      const totalTaken = Object.values(pillsTaken).reduce((sum, count) => sum + count, 0);

      if (totalTaken === totalExpected) {
        toast.success(`✅ All pills logged for ${medication.name}!`, { icon: '💊' });
        onAction?.('taken');
      } else if (totalTaken > 0) {
        toast.success(`📝 Partial dose logged for ${medication.name}`, { icon: '⚠️' });
        onAction?.('partial');
      } else {
        toast(`⏭️ Skipped ${medication.name}`, { icon: '💭' });
        onAction?.('skipped');
      }

      // Reset pill counts
      const resetState: Record<string, number> = {};
      pillComponents.forEach(component => {
        resetState[component.pillConfigurationId] = 0;
      });
      setPillsTaken(resetState);
    } catch (error) {
      console.error('❌ Failed to log multiple pill dose:', error);
      toast.error('Failed to log pills');
    } finally {
      setIsLogging(false);
    }
  };

  const handleQuickTakeAll = () => {
    const allPillsState: Record<string, number> = {};
    pillComponents.forEach(component => {
      allPillsState[component.pillConfigurationId] = component.quantity;
    });
    setPillsTaken(allPillsState);
  };

  const getTotalTaken = () => Object.values(pillsTaken).reduce((sum, count) => sum + count, 0);
  const getTotalExpected = () => pillComponents.reduce((sum, comp) => sum + comp.quantity, 0);

  // Debug the validation checks
  console.log(`🔍 MultiplePillQuickLog validation for ${medication.name}:`, {
    useMultiplePills: medication.useMultiplePills,
    hasPillConfigs: !!medication.pillConfigurations,
    hasDoseConfigs: !!medication.doseConfigurations,
    pillConfigsLength: medication.pillConfigurations?.length || 0,
    doseConfigsLength: medication.doseConfigurations?.length || 0,
    pillComponentsLength: pillComponents.length,
    pillComponents: pillComponents
  });

  // Return early if no valid configuration (after all hooks)
  if (!medication.useMultiplePills || 
      !medication.pillConfigurations || 
      !medication.doseConfigurations ||
      medication.pillConfigurations.length === 0 ||
      medication.doseConfigurations.length === 0 ||
      pillComponents.length === 0) {
    console.log(`❌ MultiplePillQuickLog: Invalid configuration for ${medication.name}, returning null`);
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: medication.color }}
          />
          <h3 className="font-medium text-gray-900">{medication.name}</h3>
        </div>
        <div className="text-sm text-gray-500">
          {getTotalTaken()}/{getTotalExpected()} pills
        </div>
      </div>

      {/* Individual Pill Controls */}
      <div className="space-y-3">
        {pillComponents.map((component) => {
          const taken = pillsTaken[component.pillConfigurationId] || 0;
          const expected = component.quantity;
          const pillConfig = component.pillConfig;

          return (
            <div key={component.pillConfigurationId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: pillConfig.color || medication.color }}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {pillConfig.strength}{pillConfig.unit} {pillConfig.color} pill
                  </div>
                  <div className="text-xs text-gray-500">
                    Need: {expected} {expected === 1 ? 'pill' : 'pills'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePillCountChange(component.pillConfigurationId, -0.5)}
                  disabled={taken <= 0}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600 text-sm font-medium"
                >
                  −
                </button>
                
                <div className="w-12 text-center">
                  <span className={`text-sm font-medium ${taken === expected ? 'text-green-600' : taken > expected ? 'text-orange-600' : 'text-gray-900'}`}>
                    {taken}
                  </span>
                </div>
                
                <button
                  onClick={() => handlePillCountChange(component.pillConfigurationId, 0.5)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium"
                >
                  +
                </button>
                
                {taken !== expected && (
                  <button
                    onClick={() => setPillsTaken(prev => ({ ...prev, [component.pillConfigurationId]: expected }))}
                    className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    Set {expected}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleQuickTakeAll}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
        >
          <Check className="h-4 w-4" />
          <span>Take All Pills</span>
        </button>
        
        <button
          onClick={handleLogDose}
          disabled={isLogging || getTotalTaken() === 0}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <Pill className="h-4 w-4" />
          <span>Log</span>
        </button>
        
        <button
          onClick={() => {
            const resetState: Record<string, number> = {};
            pillComponents.forEach(component => {
              resetState[component.pillConfigurationId] = 0;
            });
            setPillsTaken(resetState);
          }}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center space-x-2"
        >
          <X className="h-4 w-4" />
          <span>Reset</span>
        </button>
      </div>

      {/* Visual Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Progress</span>
          <span>{Math.round((getTotalTaken() / getTotalExpected()) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (getTotalTaken() / getTotalExpected()) * 100)}%` }}
          />
        </div>
      </div>

      {/* Helpful Tips */}
      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
        💡 <strong>Tip:</strong> Use + and − buttons to count half pills (0.5). Click "Take All Pills" to set everything at once.
      </div>
    </div>
  );
}
