import React from 'react';
import { useForm } from 'react-hook-form';
import { X, Search, Check } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { Medication, MedicationCategory, MedicationFrequency, MedicationUnit } from '@/types';
import { generateRandomColor, getDependencyRiskCategory, getRiskLevel } from '@/utils/helpers';
import { getMedicationSuggestions, getMedicationByName, generateTaperingPlan } from '@/services/medicationDatabase';
import toast from 'react-hot-toast';

interface MedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication?: Medication | null;
}

interface FormData {
  name: string;
  dosage: string;
  unit: MedicationUnit;
  frequency: MedicationFrequency;
  category: MedicationCategory;
  notes?: string;
  sideEffects?: string;
  interactions?: string;
  prescribedBy?: string;
  pharmacy?: string;
  pillsRemaining?: number;
  totalPills?: number;
  refillReminder: boolean;
  color: string;
  startDate: string;
  endDate?: string;
  maxDailyDose?: number;
  enableCyclicDosing: boolean;
  enableTapering: boolean;
}

const colors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#dc2626', '#059669', '#d97706'
];

export function MedicationModal({ isOpen, onClose, medication }: MedicationModalProps) {
  const { addMedication, updateMedication } = useMedicationStore();
  const isEditing = !!medication;

  // Autocomplete state
  const [medicationSuggestions, setMedicationSuggestions] = React.useState<Array<{
    name: string;
    category: string;
    riskLevel: string;
    description: string;
  }>>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [selectedMedicationData, setSelectedMedicationData] = React.useState<any>(null);
  const [taperingPlan, setTaperingPlan] = React.useState<any>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: '',
      dosage: '',
      unit: 'mg',
      frequency: 'once-daily',
      category: 'prescription',
      notes: '',
      sideEffects: '',
      interactions: '',
      prescribedBy: '',
      pharmacy: '',
      pillsRemaining: 0,
      totalPills: 0,
      refillReminder: true,
      color: generateRandomColor(),
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      maxDailyDose: 0,
      enableCyclicDosing: false,
      enableTapering: false,
    }
  });

  const selectedColor = watch('color');
  const medicationName = watch('name');
  const selectedCategory = watch('category');

  // Handle medication search and suggestions
  const handleMedicationSearch = (searchTerm: string) => {
    if (searchTerm.length >= 2) {
      const suggestions = getMedicationSuggestions(searchTerm, 8);
      setMedicationSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setMedicationSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleMedicationSelect = (suggestionName: string) => {
    const medicationData = getMedicationByName(suggestionName);
    if (medicationData) {
      setValue('name', medicationData.name);
      setValue('category', medicationData.category);
      
      // Set suggested dosage and unit if available
      if (medicationData.commonDosages.length > 0) {
        setValue('dosage', medicationData.commonDosages[0]);
      }
      if (medicationData.commonUnits.length > 0) {
        setValue('unit', medicationData.commonUnits[0] as MedicationUnit);
      }
      if (medicationData.commonFrequencies.length > 0) {
        setValue('frequency', medicationData.commonFrequencies[0] as MedicationFrequency);
      }

      // Set side effects and interactions
      if (medicationData.commonSideEffects) {
        setValue('sideEffects', medicationData.commonSideEffects.join(', '));
      }
      if (medicationData.commonInteractions) {
        setValue('interactions', medicationData.commonInteractions.join(', '));
      }

      setSelectedMedicationData(medicationData);
      setShowSuggestions(false);

      // Generate tapering plan if needed
      if (medicationData.taperingRequired) {
        const currentDose = parseFloat(medicationData.commonDosages[0] || '0');
        const plan = generateTaperingPlan(medicationData.name, currentDose, medicationData.commonUnits[0] || 'mg');
        setTaperingPlan(plan);
      } else {
        setTaperingPlan(null);
      }
    }
  };

  // Watch for medication name changes to trigger search
  React.useEffect(() => {
    if (medicationName && !isEditing) {
      handleMedicationSearch(medicationName);
    } else if (!medicationName) {
      setShowSuggestions(false);
      setSelectedMedicationData(null);
      setTaperingPlan(null);
    }
  }, [medicationName, isEditing]);

  React.useEffect(() => {
    if (isOpen) {
      if (medication) {
        reset({
          name: medication.name,
          dosage: medication.dosage,
          unit: medication.unit,
          frequency: medication.frequency,
          category: medication.category,
          notes: medication.notes || '',
          sideEffects: medication.sideEffects?.join(', ') || '',
          interactions: medication.interactions?.join(', ') || '',
          prescribedBy: medication.prescribedBy || '',
          pharmacy: medication.pharmacy || '',
          pillsRemaining: medication.pillsRemaining || 0,
          totalPills: medication.totalPills || 0,
          refillReminder: medication.refillReminder || false,
          color: medication.color,
          startDate: medication.startDate instanceof Date ? medication.startDate.toISOString().split('T')[0] : new Date(medication.startDate).toISOString().split('T')[0],
          endDate: medication.endDate ? (medication.endDate instanceof Date ? medication.endDate.toISOString().split('T')[0] : new Date(medication.endDate).toISOString().split('T')[0]) : '',
          maxDailyDose: medication.maxDailyDose || 0,
          enableCyclicDosing: !!medication.cyclicDosing,
          enableTapering: !!medication.tapering,
        });
      } else {
        reset({
          name: '',
          dosage: '',
          unit: 'mg',
          frequency: 'once-daily',
          category: 'prescription',
          notes: '',
          sideEffects: '',
          interactions: '',
          prescribedBy: '',
          pharmacy: '',
          pillsRemaining: 0,
          totalPills: 0,
          refillReminder: true,
          color: generateRandomColor(),
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          maxDailyDose: 0,
          enableCyclicDosing: false,
          enableTapering: false,
        });
      }
    }
  }, [isOpen, medication, reset]);

  const onSubmit = (data: FormData) => {
    const medicationData = {
      name: data.name.trim(),
      dosage: data.dosage.trim(),
      unit: data.unit,
      frequency: data.frequency,
      category: data.category,
      color: data.color,
      notes: data.notes?.trim() || undefined,
      sideEffects: data.sideEffects ? data.sideEffects.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      interactions: data.interactions ? data.interactions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      prescribedBy: data.prescribedBy?.trim() || undefined,
      pharmacy: data.pharmacy?.trim() || undefined,
      pillsRemaining: data.pillsRemaining || undefined,
      totalPills: data.totalPills || undefined,
      refillReminder: data.refillReminder,
      isCustom: true,
      isActive: true,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      maxDailyDose: data.maxDailyDose || undefined,
    };

    if (isEditing && medication) {
      updateMedication(medication.id, medicationData);
      toast.success('Medication updated successfully');
    } else {
      addMedication({
        ...medicationData,
        riskLevel: 'low',
        dependencyRiskCategory: 'low-risk'
      });
      toast.success('Medication added successfully');
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {isEditing ? 'Edit Medication' : 'Add New Medication'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Medication Name *
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          {...register('name', { required: 'Medication name is required' })}
                          className="input mt-1 pl-10"
                          placeholder="Search medications, supplements, vitamins..."
                          onFocus={() => medicationName && medicationName.length >= 2 && setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                      </div>
                      
                      {/* Suggestions Dropdown */}
                      {showSuggestions && medicationSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {medicationSuggestions.map((suggestion, index) => (
                            <button
                              key={`${suggestion.name}-${index}`}
                              type="button"
                              onClick={() => handleMedicationSelect(suggestion.name)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{suggestion.name}</div>
                                  <div className="text-sm text-gray-500">{suggestion.description}</div>
                                </div>
                                <div className="flex flex-col items-end ml-4">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    suggestion.category === 'prescription' ? 'bg-blue-100 text-blue-800' :
                                    suggestion.category === 'over-the-counter' ? 'bg-green-100 text-green-800' :
                                    suggestion.category === 'supplement' ? 'bg-yellow-100 text-yellow-800' :
                                    suggestion.category === 'vitamin' ? 'bg-purple-100 text-purple-800' :
                                    suggestion.category === 'herbal' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {suggestion.category}
                                  </span>
                                  <span className={`mt-1 text-xs px-1 py-0.5 rounded ${
                                    suggestion.riskLevel === 'high' ? 'bg-red-100 text-red-600' :
                                    suggestion.riskLevel === 'moderate' ? 'bg-orange-100 text-orange-600' :
                                    suggestion.riskLevel === 'low' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {suggestion.riskLevel} risk
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                    
                    {/* Selected Medication Info */}
                    {selectedMedicationData && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Medication Auto-filled</span>
                        </div>
                        <p className="text-sm text-blue-700 mt-1">{selectedMedicationData.description}</p>
                        {selectedMedicationData.withdrawalRisk !== 'none' && (
                          <p className="text-sm text-orange-600 mt-1 font-medium">
                            ⚠️ Withdrawal Risk: {selectedMedicationData.withdrawalRisk}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Dosage *
                    </label>
                    <input
                      type="text"
                      {...register('dosage', { required: 'Dosage is required' })}
                      className="input mt-1"
                      placeholder="e.g., 50"
                    />
                    {errors.dosage && (
                      <p className="mt-1 text-sm text-red-600">{errors.dosage.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Unit *
                    </label>
                    <select {...register('unit')} className="input mt-1">
                      <optgroup label="Weight">
                        <option value="mg">mg</option>
                        <option value="g">g</option>
                        <option value="mcg">mcg</option>
                        <option value="μg">μg</option>
                        <option value="ng">ng</option>
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                        <option value="oz">oz</option>
                        <option value="ounces">ounces</option>
                      </optgroup>
                      <optgroup label="Volume">
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="fl oz">fl oz</option>
                        <option value="tsp">tsp</option>
                        <option value="tbsp">tbsp</option>
                      </optgroup>
                      <optgroup label="Pills & Tablets">
                        <option value="tablets">tablets</option>
                        <option value="capsules">capsules</option>
                        <option value="pills">pills</option>
                      </optgroup>
                      <optgroup label="Applications">
                        <option value="drops">drops</option>
                        <option value="sprays">sprays</option>
                        <option value="puffs">puffs</option>
                        <option value="patches">patches</option>
                        <option value="applications">applications</option>
                        <option value="injections">injections</option>
                        <option value="inhalations">inhalations</option>
                      </optgroup>
                      <optgroup label="Units & Measurements">
                        <option value="iu">iu</option>
                        <option value="IU">IU</option>
                        <option value="units">units</option>
                        <option value="mEq">mEq</option>
                        <option value="mmol">mmol</option>
                        <option value="%">%</option>
                      </optgroup>
                      <optgroup label="Specialized">
                        <option value="mg THC">mg THC</option>
                        <option value="mg CBD">mg CBD</option>
                        <option value="billion CFU">billion CFU</option>
                        <option value="million CFU">million CFU</option>
                      </optgroup>
                      <optgroup label="Beverages">
                        <option value="drinks">drinks</option>
                        <option value="shots">shots</option>
                        <option value="beers">beers</option>
                        <option value="glasses">glasses</option>
                      </optgroup>
                      <optgroup label="Packaging">
                        <option value="vials">vials</option>
                        <option value="ampules">ampules</option>
                        <option value="sachets">sachets</option>
                        <option value="packets">packets</option>
                        <option value="scoops">scoops</option>
                        <option value="cartridges">cartridges</option>
                      </optgroup>
                      <optgroup label="General">
                        <option value="doses">doses</option>
                        <option value="hits">hits</option>
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Frequency *
                    </label>
                    <select {...register('frequency')} className="input mt-1">
                      <option value="as-needed">As needed</option>
                      <option value="once-daily">Once daily</option>
                      <option value="twice-daily">Twice daily</option>
                      <option value="three-times-daily">Three times daily</option>
                      <option value="four-times-daily">Four times daily</option>
                      <option value="every-other-day">Every other day</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Category *
                    </label>
                    <select {...register('category')} className="input mt-1">
                      <option value="prescription">Prescription</option>
                      <option value="over-the-counter">Over-the-counter</option>
                      <option value="supplement">Supplement</option>
                      <option value="vitamin">Vitamin</option>
                      <option value="herbal">Herbal</option>
                      <option value="recreational">Recreational</option>
                      <option value="injection">Injection</option>
                      <option value="topical">Topical</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                {/* Recreational Drug Warning & Info */}
                {selectedCategory === 'recreational' && (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800">⚠️ Recreational Substance - Important Safety Information</h4>
                        <div className="mt-2 text-sm text-red-700">
                          {selectedMedicationData && (
                            <>
                              <p className="font-medium">Risk Level: <span className="uppercase">{selectedMedicationData.riskLevel}</span></p>
                              <p className="mt-1">{selectedMedicationData.description}</p>
                            </>
                          )}
                          
                          {/* Psychonaut Wiki Dosage Info */}
                          {selectedMedicationData?.commonDosages && selectedMedicationData.commonDosages.length >= 5 && (
                            <div className="mt-3 p-3 bg-white rounded border">
                              <h5 className="font-medium text-gray-900 mb-2">📊 Psychonaut Wiki Dosage Chart:</h5>
                              <div className="grid grid-cols-5 gap-2 text-xs">
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">Threshold</div>
                                  <div className="text-blue-600">{selectedMedicationData.commonDosages[0]}{selectedMedicationData.commonUnits[0]}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">Light</div>
                                  <div className="text-green-600">{selectedMedicationData.commonDosages[1]}{selectedMedicationData.commonUnits[0]}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">Common</div>
                                  <div className="text-yellow-600">{selectedMedicationData.commonDosages[2]}{selectedMedicationData.commonUnits[0]}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">Strong</div>
                                  <div className="text-orange-600">{selectedMedicationData.commonDosages[3]}{selectedMedicationData.commonUnits[0]}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-medium text-gray-700">Heavy</div>
                                  <div className="text-red-600">{selectedMedicationData.commonDosages[4]}{selectedMedicationData.commonUnits[0]}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Harm Reduction Messages */}
                          {selectedMedicationData?.psychologicalSupport?.motivationalMessages && (
                            <div className="mt-3 p-3 bg-blue-50 rounded border">
                              <h5 className="font-medium text-blue-900 mb-2">🛡️ Harm Reduction Guidelines:</h5>
                              <ul className="text-xs text-blue-800 space-y-1">
                                {selectedMedicationData.psychologicalSupport.motivationalMessages.slice(0, 4).map((message: string, index: number) => (
                                  <li key={index} className="flex items-start">
                                    <span className="text-blue-500 mr-1">•</span>
                                    <span>{message}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Risk Triggers */}
                          {selectedMedicationData?.psychologicalSupport?.riskTriggers && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded border">
                              <h5 className="font-medium text-yellow-900 mb-2">⚠️ High-Risk Situations:</h5>
                              <div className="text-xs text-yellow-800">
                                {selectedMedicationData.psychologicalSupport.riskTriggers.join(', ')}
                              </div>
                            </div>
                          )}

                          {/* General recreational drug warning */}
                          {!selectedMedicationData && (
                            <div className="mt-3 p-3 bg-yellow-50 rounded border">
                              <h5 className="font-medium text-yellow-900 mb-2">⚠️ General Recreational Substance Guidelines:</h5>
                              <ul className="text-xs text-yellow-800 space-y-1">
                                <li>• Research the substance thoroughly before use</li>
                                <li>• Start with the lowest possible dose</li>
                                <li>• Test substances with reagent kits when available</li>
                                <li>• Use in safe environments with trusted people</li>
                                <li>• Avoid mixing with other substances</li>
                                <li>• Be aware of legal status in your jurisdiction</li>
                              </ul>
                            </div>
                          )}

                          <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-700">
                            <strong>Legal Notice:</strong> This substance may be illegal in your jurisdiction. 
                            <strong className="block mt-1">Medical Disclaimer:</strong> This information is for harm reduction purposes only and does not constitute medical advice. 
                            Always consult healthcare professionals for substance-related concerns.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color, index) => (
                        <button
                          key={`color-${index}-${color}`}
                          type="button"
                          onClick={() => setValue('color', color)}
                          className={`w-6 h-6 rounded-full border-2 ${
                            selectedColor === color ? 'border-gray-900' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      {...register('startDate', { required: 'Start date is required' })}
                      className="input mt-1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      {...register('endDate')}
                      className="input mt-1"
                    />
                  </div>
                </div>

                {/* Inventory Management */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Inventory Management</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Pills Remaining
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register('pillsRemaining', { valueAsNumber: true })}
                        className="input mt-1"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Total Pills
                      </label>
                      <input
                        type="number"
                        min="0"
                        {...register('totalPills', { valueAsNumber: true })}
                        className="input mt-1"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('refillReminder')}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable refill reminders
                    </label>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Additional Information</h4>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Prescribed By
                      </label>
                      <input
                        type="text"
                        {...register('prescribedBy')}
                        className="input mt-1"
                        placeholder="Doctor's name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Pharmacy
                      </label>
                      <input
                        type="text"
                        {...register('pharmacy')}
                        className="input mt-1"
                        placeholder="Pharmacy name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Notes
                    </label>
                    <textarea
                      {...register('notes')}
                      rows={3}
                      className="input mt-1"
                      placeholder="Any additional notes about this medication..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Side Effects (comma-separated)
                    </label>
                    <input
                      type="text"
                      {...register('sideEffects')}
                      className="input mt-1"
                      placeholder="e.g., nausea, headache, dizziness"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Drug Interactions (comma-separated)
                    </label>
                    <input
                      type="text"
                      {...register('interactions')}
                      className="input mt-1"
                      placeholder="e.g., aspirin, warfarin"
                    />
                  </div>
                </div>

                {/* Advanced Features */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900">Advanced Features</h4>
                  
                  {/* Tapering Plan Display */}
                  {taperingPlan && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-orange-600 font-medium">⚠️ Tapering Plan Required</span>
                      </div>
                      <p className="text-sm text-orange-700 mb-3">
                        This medication requires gradual tapering to prevent withdrawal symptoms.
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Method:</strong> {taperingPlan.method}
                        </div>
                        <div className="text-sm">
                          <strong>Duration:</strong> {taperingPlan.totalDuration} days
                        </div>
                        <div className="text-sm">
                          <strong>Risk Level:</strong> {taperingPlan.riskLevel}
                        </div>
                        {taperingPlan.steps.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-sm font-medium text-orange-700 cursor-pointer">
                              View Tapering Schedule
                            </summary>
                            <div className="mt-2 space-y-1">
                              {taperingPlan.steps.slice(0, 3).map((step: any, index: number) => (
                                <div key={index} className="text-xs text-orange-600 pl-4">
                                  • {step.notes}
                                </div>
                              ))}
                              {taperingPlan.steps.length > 3 && (
                                <div className="text-xs text-orange-500 pl-4">
                                  ... and {taperingPlan.steps.length - 3} more steps
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                        <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
                          <strong>Important:</strong> Always consult your healthcare provider before starting any tapering schedule.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Risk Assessment Display */}
                  {watch('name') && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Risk Assessment:</span>
                        <span className={`badge ${
                          (selectedMedicationData?.riskLevel || getRiskLevel(getDependencyRiskCategory(watch('name')))) === 'high' ? 'badge-danger' :
                          (selectedMedicationData?.riskLevel || getRiskLevel(getDependencyRiskCategory(watch('name')))) === 'moderate' ? 'badge-warning' :
                          (selectedMedicationData?.riskLevel || getRiskLevel(getDependencyRiskCategory(watch('name')))) === 'low' ? 'badge-success' :
                          'badge-secondary'
                        }`}>
                          {selectedMedicationData?.riskLevel || getRiskLevel(getDependencyRiskCategory(watch('name')))} risk
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Category: {selectedMedicationData?.dependencyRiskCategory?.replace('-', ' ') || getDependencyRiskCategory(watch('name')).replace('-', ' ')}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Maximum Daily Dose (Safety Limit)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        {...register('maxDailyDose', { valueAsNumber: true })}
                        className="input mt-1"
                        placeholder="Optional safety limit"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Set a maximum daily dose to prevent accidental overdosing
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('enableCyclicDosing')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Enable cyclic dosing patterns
                      </label>
                    </div>
                    
                    {watch('enableCyclicDosing') && (
                      <div className="ml-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
                        <p className="text-sm font-medium text-indigo-900">Quick Setup Options</p>
                        <p className="text-xs text-indigo-700">
                          You can set up detailed patterns after saving the medication
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <button 
                            type="button"
                            className="p-3 bg-white border border-indigo-200 rounded-md text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            onClick={() => {
                              // This will be handled after the medication is saved
                              toast.success('On/Off Cycle pattern will be available after saving the medication');
                            }}
                          >
                            <div className="text-sm font-medium text-gray-900">On/Off Cycle</div>
                            <div className="text-xs text-gray-600 mt-1">5 days on, 2 days off</div>
                          </button>
                          <button 
                            type="button"
                            className="p-3 bg-white border border-indigo-200 rounded-md text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            onClick={() => {
                              // This will be handled after the medication is saved
                              toast.success('Variable Dose pattern will be available after saving the medication');
                            }}
                          >
                            <div className="text-sm font-medium text-gray-900">Variable Dose</div>
                            <div className="text-xs text-gray-600 mt-1">Different weekend dose</div>
                          </button>
                          <button 
                            type="button"
                            className="p-3 bg-white border border-indigo-200 rounded-md text-center hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                            onClick={() => {
                              // This will be handled after the medication is saved
                              toast.success('Holiday Schedule pattern will be available after saving the medication');
                            }}
                          >
                            <div className="text-sm font-medium text-gray-900">Holiday Schedule</div>
                            <div className="text-xs text-gray-600 mt-1">Break during holidays</div>
                          </button>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                          <p className="text-xs text-blue-800">
                            <strong>💡 Tip:</strong> After saving this medication, visit the "Cyclic Dosing" page to create custom patterns, 
                            set specific start dates, and configure detailed phase messages.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 ml-6">
                      Support for on/off cycles, variable dosing, and holiday schedules
                    </p>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('enableTapering')}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Enable tapering schedule
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">
                      Gradual dose reduction to safely discontinue medication
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                className="btn-primary w-full sm:ml-3 sm:w-auto"
              >
                {isEditing ? 'Update Medication' : 'Add Medication'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary mt-3 w-full sm:mt-0 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
