import React, { useState } from 'react';
import { Plus, Minus, Pill, Save, X } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { PillConfiguration, DoseConfiguration, PillDoseComponent } from '@/types';
import { generateId } from '@/utils/helpers';

interface MultiplePillSelectorProps {
  medicationId: string;
  onClose: () => void;
}

export function MultiplePillSelector({ medicationId, onClose }: MultiplePillSelectorProps) {
  const {
    medications,
    addPillConfiguration,
    addDoseConfiguration,
    enableMultiplePills,
    calculateTotalDoseFromPills,
    updateMedication,
  } = useMedicationStore();

  const medication = medications.find((med) => med.id === medicationId);
  
  // Initialize with existing configurations if they exist, otherwise use defaults
  const [pillConfigs, setPillConfigs] = useState<Omit<PillConfiguration, 'id'>[]>(() => {
    if (medication?.pillConfigurations && medication.pillConfigurations.length > 0) {
      return medication.pillConfigurations.map(config => ({
        strength: config.strength,
        unit: config.unit,
        color: config.color || 'white',
        shape: config.shape || 'round',
        isActive: config.isActive !== false,
        markings: config.markings || ''
      }));
    }
    return [
      {
        strength: parseFloat(medication?.dosage || '1'),
        unit: medication?.unit || 'mg',
        color: 'white',
        shape: 'round',
        isActive: true,
        markings: ''
      },
    ];
  });

  const [doseComponents, setDoseComponents] = useState<Omit<PillDoseComponent, 'pillConfigurationId'>[]>(() => {
    if (medication?.doseConfigurations && medication.doseConfigurations.length > 0) {
      const defaultDoseConfig = medication.doseConfigurations.find(
        config => config.id === medication.defaultDoseConfigurationId
      ) || medication.doseConfigurations[0];
      
      if (defaultDoseConfig?.pillComponents) {
        return defaultDoseConfig.pillComponents.map(component => ({
          quantity: component.quantity,
          timing: 'together'
        }));
      }
    }
    return [{ quantity: 1, timing: 'together' }];
  });

  if (!medication) return null;

  const addPillConfig = () => {
    setPillConfigs([
      ...pillConfigs,
      {
        strength: 1,
        unit: medication.unit,
        color: 'white',
        shape: 'round',
        isActive: true,
      },
    ]);
  };

  const removePillConfig = (index: number) => {
    if (pillConfigs.length > 1) {
      setPillConfigs(pillConfigs.filter((_, i) => i !== index));
      // Remove corresponding dose components that reference this pill
      setDoseComponents(doseComponents.filter((_, i) => i !== index));
    }
  };

  const updatePillConfig = (index: number, updates: Partial<PillConfiguration>) => {
    setPillConfigs(
      pillConfigs.map((config, i) => (i === index ? { ...config, ...updates } : config))
    );
  };

  const updateDoseComponent = (index: number, updates: Partial<PillDoseComponent>) => {
    setDoseComponents(
      doseComponents.map((component, i) => (i === index ? { ...component, ...updates } : component))
    );
  };

  const addDoseComponent = () => {
    if (doseComponents.length < pillConfigs.length) {
      setDoseComponents([...doseComponents, { quantity: 1, timing: 'together' }]);
    }
  };

  const calculateTotalDose = () => {
    let total = 0;
    doseComponents.forEach((component, index) => {
      if (pillConfigs[index]) {
        total += pillConfigs[index].strength * component.quantity;
      }
    });
    return total;
  };

  const handleSave = () => {
    // Create new pill configurations with IDs
    const newPillConfigs = pillConfigs.map(config => ({
      ...config,
      id: generateId()
    }));

    // Create dose configuration with proper pill component links
    const doseConfig: DoseConfiguration = {
      id: generateId(),
      name: 'Standard Dose',
      pillComponents: doseComponents.map((component, index) => ({
        ...component,
        pillConfigurationId: newPillConfigs[index]?.id || generateId(),
      })),
      totalDoseAmount: calculateTotalDose(),
      totalDoseUnit: medication.unit,
      instructions: `Configured dose for ${medication.name}`,
      isDefault: true,
    };

    // Create or preserve pill inventory
    const pillInventory = newPillConfigs.map((config, index) => {
      // Try to find existing inventory for this pill configuration
      const existingInventory = medication.pillInventory?.find(inv => {
        // Match by index for existing configurations
        const existingConfig = medication.pillConfigurations?.[index];
        return existingConfig && inv.pillConfigurationId === existingConfig.id;
      });
      
      return {
        pillConfigurationId: config.id,
        currentCount: existingInventory?.currentCount ?? medication.pillsRemaining ?? 30,
        lastUpdated: new Date(),
        // Preserve other inventory properties if they exist
        ...(existingInventory ? {
          expirationDate: existingInventory.expirationDate,
          batchNumber: existingInventory.batchNumber,
          costPerPill: existingInventory.costPerPill,
          supplier: existingInventory.supplier,
          lotNumber: existingInventory.lotNumber,
          reorderPoint: existingInventory.reorderPoint,
          safetyStock: existingInventory.safetyStock,
        } : {})
      };
    });

    // Update the medication with new configuration
    updateMedication(medicationId, {
      useMultiplePills: true,
      pillConfigurations: newPillConfigs,
      doseConfigurations: [doseConfig],
      defaultDoseConfigurationId: doseConfig.id,
      pillInventory: pillInventory,
      updatedAt: new Date(),
    });


    onClose();
  };

  return (
    <div className="fixed inset-0 glass-overlay flex items-center justify-center p-4 z-[60] mobile-safe-area">
      <div className="glass-panel rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mobile-scroll">
        <div className="sticky top-0 bg-white/70 backdrop-blur-md border-b border-gray-200/70 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Pill className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {medication.useMultiplePills ? 'Edit' : 'Setup'} Multiple Pills for {medication.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {medication.useMultiplePills 
                    ? 'Edit your existing pill configuration'
                    : 'Configure different pill strengths and combinations'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Current medication info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Current Configuration</p>
            <p className="text-sm text-blue-700">
              {medication.dosage} {medication.unit} • {medication.frequency.replace('-', ' ')}
            </p>
          </div>

          {/* Pill Configurations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-900">Available Pill Strengths</h4>
              <button
                onClick={addPillConfig}
                className="btn-secondary text-sm flex items-center space-x-1"
              >
                <Plus className="h-4 w-4" />
                <span>Add Strength</span>
              </button>
            </div>

            <div className="space-y-3">
              {pillConfigs.map((config, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Pill {index + 1}
                    </span>
                    {pillConfigs.length > 1 && (
                      <button
                        onClick={() => removePillConfig(index)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Strength
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          step="0.1"
                          value={config.strength}
                          onChange={(e) =>
                            updatePillConfig(index, { strength: parseFloat(e.target.value) })
                          }
                        className="input flex-1"
                        />
                        <select
                          value={config.unit}
                          onChange={(e) =>
                            updatePillConfig(index, { unit: e.target.value as any })
                          }
                          className="input w-24"
                        >
                          <optgroup label="Weight">
                            <option value="mg">mg</option>
                            <option value="g">g</option>
                            <option value="mcg">mcg</option>
                            <option value="μg">μg</option>
                            <option value="ng">ng</option>
                          </optgroup>
                          <optgroup label="Volume">
                            <option value="ml">ml</option>
                            <option value="L">L</option>
                            <option value="fl oz">fl oz</option>
                          </optgroup>
                          <optgroup label="Units">
                            <option value="iu">iu</option>
                            <option value="IU">IU</option>
                            <option value="units">units</option>
                            <option value="mEq">mEq</option>
                            <option value="mmol">mmol</option>
                          </optgroup>
                          <optgroup label="Specialized">
                            <option value="mg THC">mg THC</option>
                            <option value="mg CBD">mg CBD</option>
                            <option value="billion CFU">billion CFU</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <select
                        value={config.color}
                        onChange={(e) => updatePillConfig(index, { color: e.target.value })}
                        className="input"
                      >
                        <option value="white">White</option>
                        <option value="blue">Blue</option>
                        <option value="red">Red</option>
                        <option value="yellow">Yellow</option>
                        <option value="green">Green</option>
                        <option value="pink">Pink</option>
                        <option value="orange">Orange</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dose Configuration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-md font-medium text-gray-900">Dose Combination</h4>
              {doseComponents.length < pillConfigs.length && (
                <button
                  onClick={addDoseComponent}
                  className="btn-secondary text-sm flex items-center space-x-1"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Component</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {doseComponents.map((component, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {pillConfigs[index]?.strength} {pillConfigs[index]?.unit} pills
                    </span>
                    <span className="text-xs text-gray-500">
                      {pillConfigs[index]?.color} • {pillConfigs[index]?.shape}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={component.quantity}
                        onChange={(e) =>
                          updateDoseComponent(index, { quantity: parseFloat(e.target.value) })
                        }
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Timing
                      </label>
                      <select
                        value={component.timing}
                        onChange={(e) =>
                          updateDoseComponent(index, { timing: e.target.value as any })
                        }
                        className="input-field"
                      >
                        <option value="together">Take together</option>
                        <option value="split">Split throughout day</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Dose Preview */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h5 className="text-sm font-medium text-green-900 mb-2">Total Dose Preview</h5>
            <p className="text-lg font-semibold text-green-800">
              {calculateTotalDose()} {medication.unit}
            </p>
            <p className="text-sm text-green-700">
              {doseComponents.reduce((sum, comp) => sum + comp.quantity, 0)} total pills per dose
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>{medication.useMultiplePills ? 'Update Configuration' : 'Enable Multiple Pills'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
