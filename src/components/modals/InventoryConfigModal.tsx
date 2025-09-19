import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Package, MapPin, Star } from 'lucide-react';
import { PharmacyInfo, PersonalMedicationTracking } from '@/types/enhanced-inventory';
import { Medication } from '@/types';
import { generateId } from '@/utils/helpers';

interface InventoryConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  medications: Medication[];
  onSave: (pharmacies: PharmacyInfo[], trackingSettings: PersonalMedicationTracking[]) => void;
  existingPharmacies?: PharmacyInfo[];
  existingTracking?: PersonalMedicationTracking[];
}

export function InventoryConfigModal({
  isOpen,
  onClose,
  medications,
  onSave,
  existingPharmacies = [],
  existingTracking = []
}: InventoryConfigModalProps) {
  const [pharmacies, setPharmacies] = useState<PharmacyInfo[]>(existingPharmacies);
  const [trackingSettings, setTrackingSettings] = useState<PersonalMedicationTracking[]>(existingTracking);
  const [activeTab, setActiveTab] = useState<'pharmacies' | 'medications'>('pharmacies');

  // Initialize tracking settings for medications that don't have them
  useEffect(() => {
    const medicationsWithoutTracking = medications.filter(med => 
      med.isActive && !trackingSettings.find(ts => ts.medicationId === med.id)
    );

    if (medicationsWithoutTracking.length > 0) {
      const newTrackingSettings = medicationsWithoutTracking.map(med => createDefaultTracking(med));
      setTrackingSettings(prev => [...prev, ...newTrackingSettings]);
    }
  }, [medications, trackingSettings]);

  const createDefaultTracking = (medication: Medication): PersonalMedicationTracking => ({
    medicationId: medication.id,
    preferredPharmacy: pharmacies.find(p => p.isPreferred)?.id,
    typicalRefillDays: 2,
    reminderDaysAdvance: 7,
    minimumDaysSupply: 3,
    refillReminderEnabled: true,
    preferredDeliveryMethod: 'pickup',
    allowBackupDeliveryMethods: true,
    emergencyDeliveryThreshold: 2
  });

  const addPharmacy = () => {
    const newPharmacy: PharmacyInfo = {
      id: generateId(),
      name: '',
      typicalRefillTime: 1,
      isPreferred: pharmacies.length === 0, // First pharmacy is preferred by default
      deliveryOptions: {
        pickup: { enabled: true, avgTime: 0.5 },
        standardDelivery: { enabled: false, avgTime: 2 },
        expeditedDelivery: { enabled: false, avgTime: 1 },
        sameDay: { enabled: false, avgTime: 0.25, cutoffTime: '14:00' }
      },
      deliveryReliability: 'good'
    };
    setPharmacies([...pharmacies, newPharmacy]);
  };

  const updatePharmacy = (id: string, updates: Partial<PharmacyInfo>) => {
    setPharmacies(pharmacies.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePharmacy = (id: string) => {
    setPharmacies(pharmacies.filter(p => p.id !== id));
    // Update tracking settings that reference this pharmacy
    setTrackingSettings(trackingSettings.map(ts => ({
      ...ts,
      preferredPharmacy: ts.preferredPharmacy === id ? undefined : ts.preferredPharmacy,
      backupPharmacy: ts.backupPharmacy === id ? undefined : ts.backupPharmacy
    })));
  };

  const updateTracking = (medicationId: string, updates: Partial<PersonalMedicationTracking>) => {
    setTrackingSettings(trackingSettings.map(ts => 
      ts.medicationId === medicationId ? { ...ts, ...updates } : ts
    ));
  };

  const handleSave = () => {
    onSave(pharmacies, trackingSettings);
    onClose();
  };

  // Prevent body scroll when modal is open (iOS Safari friendly)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto mobile-safe-area">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 glass-overlay transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg glass-panel text-left shadow-xl transition-all sm:my-8 w-full max-w-4xl mx-4 sm:mx-0 mobile-modal">
          <div className="max-h-[90vh] overflow-y-auto mobile-scroll">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex space-x-0">
            <button
              onClick={() => setActiveTab('pharmacies')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'pharmacies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Pharmacies & Delivery</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('medications')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'medications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Medication Settings</span>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] mobile-scroll">
          {activeTab === 'pharmacies' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Your Pharmacies</h3>
                <button
                  onClick={addPharmacy}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Pharmacy</span>
                </button>
              </div>

              {pharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        placeholder="Pharmacy name"
                        value={pharmacy.name}
                        onChange={(e) => updatePharmacy(pharmacy.id, { name: e.target.value })}
                        className="font-medium text-lg border-0 bg-transparent focus:outline-none focus:ring-0 p-0"
                      />
                      {pharmacy.isPreferred && (
                        <Star className="h-5 w-5 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updatePharmacy(pharmacy.id, { isPreferred: !pharmacy.isPreferred })}
                        className={`text-sm px-3 py-1 rounded ${
                          pharmacy.isPreferred
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pharmacy.isPreferred ? 'Preferred' : 'Set as Preferred'}
                      </button>
                      <button
                        onClick={() => removePharmacy(pharmacy.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        value={pharmacy.address || ''}
                        onChange={(e) => updatePharmacy(pharmacy.id, { address: e.target.value })}
                        className="input"
                        placeholder="123 Main St, City, State"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={pharmacy.phone || ''}
                        onChange={(e) => updatePharmacy(pharmacy.id, { phone: e.target.value })}
                        className="input"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Options
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(pharmacy.deliveryOptions).map(([method, config]) => (
                        <div key={method} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={config.enabled}
                                onChange={(e) => updatePharmacy(pharmacy.id, {
                                  deliveryOptions: {
                                    ...pharmacy.deliveryOptions,
                                    [method]: { ...config, enabled: e.target.checked }
                                  }
                                })}
                                className="rounded text-blue-600"
                              />
                              <span className="text-sm font-medium capitalize">
                                {method.replace(/([A-Z])/g, ' $1').toLowerCase()}
                              </span>
                            </label>
                          </div>
                          {config.enabled && (
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs text-gray-500">
                                  Avg Time ({method === 'sameDay' ? 'hours' : 'days'})
                                </label>
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  value={config.avgTime}
                                  onChange={(e) => updatePharmacy(pharmacy.id, {
                                    deliveryOptions: {
                                      ...pharmacy.deliveryOptions,
                                      [method]: { ...config, avgTime: parseFloat(e.target.value) || 0 }
                                    }
                                  })}
                                  className="input text-sm"
                                />
                              </div>
                              {('cost' in config) && (
                                <div>
                                  <label className="block text-xs text-gray-500">Cost ($)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={('cost' in config && config.cost) || ''}
                                    onChange={(e) => updatePharmacy(pharmacy.id, {
                                      deliveryOptions: {
                                        ...pharmacy.deliveryOptions,
                                        [method]: { ...config, cost: parseFloat(e.target.value) || 0 }
                                      }
                                    })}
                                    className="input text-sm"
                                    placeholder="0.00"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Reliability
                    </label>
                    <select
                      value={pharmacy.deliveryReliability}
                      onChange={(e) => updatePharmacy(pharmacy.id, { 
                        deliveryReliability: e.target.value as 'excellent' | 'good' | 'fair' | 'poor'
                      })}
                      className="input"
                    >
                      <option value="excellent">Excellent - Always on time</option>
                      <option value="good">Good - Usually on time</option>
                      <option value="fair">Fair - Sometimes delayed</option>
                      <option value="poor">Poor - Often delayed</option>
                    </select>
                  </div>
                </div>
              ))}

              {pharmacies.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No pharmacies configured yet.</p>
                  <p className="text-sm">Add a pharmacy to start tracking deliveries.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'medications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Medication Tracking Settings</h3>
              
              {medications.filter(med => med.isActive).map((medication) => {
                const tracking = trackingSettings.find(ts => ts.medicationId === medication.id);
                if (!tracking) return null;

                return (
                  <div key={medication.id} className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-medium text-gray-900">{medication.name}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preferred Pharmacy
                        </label>
                        <select
                          value={tracking.preferredPharmacy || ''}
                          onChange={(e) => updateTracking(medication.id, { preferredPharmacy: e.target.value || undefined })}
                          className="input"
                        >
                          <option value="">No preference</option>
                          {pharmacies.map(pharmacy => (
                            <option key={pharmacy.id} value={pharmacy.id}>
                              {pharmacy.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preferred Delivery Method
                        </label>
                        <select
                          value={tracking.preferredDeliveryMethod}
                          onChange={(e) => updateTracking(medication.id, { 
                            preferredDeliveryMethod: e.target.value as any 
                          })}
                          className="input"
                        >
                          <option value="pickup">Pickup</option>
                          <option value="standardDelivery">Standard Delivery</option>
                          <option value="expeditedDelivery">Expedited Delivery</option>
                          <option value="sameDay">Same Day</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reminder Days in Advance
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={tracking.reminderDaysAdvance}
                          onChange={(e) => updateTracking(medication.id, { 
                            reminderDaysAdvance: parseInt(e.target.value) || 7 
                          })}
                          className="input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Minimum Days Supply
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={tracking.minimumDaysSupply}
                          onChange={(e) => updateTracking(medication.id, { 
                            minimumDaysSupply: parseInt(e.target.value) || 3 
                          })}
                          className="input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Emergency Delivery Threshold
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={tracking.emergencyDeliveryThreshold}
                          onChange={(e) => updateTracking(medication.id, { 
                            emergencyDeliveryThreshold: parseInt(e.target.value) || 2 
                          })}
                          className="input"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Days remaining to trigger emergency delivery options
                        </p>
                      </div>

                      <div className="flex items-center">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={tracking.allowBackupDeliveryMethods}
                            onChange={(e) => updateTracking(medication.id, { 
                              allowBackupDeliveryMethods: e.target.checked 
                            })}
                            className="rounded text-blue-600"
                          />
                          <span className="text-sm">Allow backup delivery methods</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
          >
            Save Configuration
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
