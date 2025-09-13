import React from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Clock,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Shield,
  ShieldAlert,
  Activity,
  TrendingDown,
  Calendar,
  Pause,
  Play,
  Coffee,
  Pill
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { MedicationModal } from '@/components/modals/MedicationModal';
import { TaperingPlanModal } from '@/components/modals/TaperingPlanModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MultiplePillSelector } from '@/components/ui/MultiplePillSelector';
import { SideEffectReportModal } from '@/components/modals/SideEffectReportModal';
import { WithdrawalTrackingModal } from '@/components/modals/WithdrawalTrackingModal';
import { DependencyPreventionModal } from '@/components/modals/DependencyPreventionModal';
import { formatFrequency, formatDosage, cn, filterMedicationsBySearch, formatPillDisplay, formatPillDisplayShort } from '@/utils/helpers';
import { getMedicationByName } from '@/services/medicationDatabase';
import { Medication, MedicationCategory } from '@/types';
import toast from 'react-hot-toast';

export function Medications() {
  const {
    medications,
    deleteMedication,
    toggleMedicationActive,
    getMedicationAdherence,
    getCurrentDose,
    pauseTaperingSchedule,
    resumeTaperingSchedule,
    adjustTaperingSchedule,
    // getHighRiskMedications,
    updateRiskAssessment
  } = useMedicationStore();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingMedication, setEditingMedication] = React.useState<Medication | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<MedicationCategory | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [taperingModalOpen, setTaperingModalOpen] = React.useState(false);
  const [taperingMedication, setTaperingMedication] = React.useState<Medication | null>(null);
  const [pauseModalOpen, setPauseModalOpen] = React.useState(false);
  const [pauseMedication, setPauseMedication] = React.useState<Medication | null>(null);
  const [multiplePillsModalOpen, setMultiplePillsModalOpen] = React.useState(false);
  const [multiplePillsMedication, setMultiplePillsMedication] = React.useState<string | null>(null);
  const [sideEffectModalOpen, setSideEffectModalOpen] = React.useState(false);
  const [sideEffectMedication, setSideEffectMedication] = React.useState<Medication | null>(null);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = React.useState(false);
  const [withdrawalMedication, setWithdrawalMedication] = React.useState<Medication | null>(null);
  const [dependencyModalOpen, setDependencyModalOpen] = React.useState(false);
  const [dependencyMedication, setDependencyMedication] = React.useState<Medication | null>(null);

  const filteredMedications = React.useMemo(() => {
    let filtered = medications;

    // Filter by search term
    if (searchTerm) {
      filtered = filterMedicationsBySearch(filtered, searchTerm);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(med => med.category === selectedCategory);
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [medications, searchTerm, selectedCategory]);

  const activeMedications = filteredMedications.filter(med => med.isActive);
  const inactiveMedications = filteredMedications.filter(med => !med.isActive);

  const handleAddMedication = () => {
    setEditingMedication(null);
    setIsModalOpen(true);
  };

  const handleEditMedication = (medication: Medication) => {
    setEditingMedication(medication);
    setIsModalOpen(true);
  };

  const handleDeleteMedication = (id: string) => {
    deleteMedication(id);
    setConfirmDelete(null);
  };

  const handleToggleActive = (id: string) => {
    toggleMedicationActive(id);
  };

  const handleOpenTaperingPlan = (medication: Medication) => {
    setTaperingMedication(medication);
    setTaperingModalOpen(true);
  };

  const handlePauseTapering = (medication: Medication) => {
    setPauseMedication(medication);
    setPauseModalOpen(true);
  };

  const handleConfirmPause = (severity: 'mild' | 'moderate' | 'severe') => {
    if (pauseMedication) {
      pauseTaperingSchedule(pauseMedication.id, severity);
      setPauseModalOpen(false);
      setPauseMedication(null);
      toast.success(`Tapering paused for ${pauseMedication.name}. Take time to stabilize.`);
    }
  };

  const handleOpenMultiplePills = (medicationId: string) => {
    setMultiplePillsMedication(medicationId);
    setMultiplePillsModalOpen(true);
  };

  const handleCloseMultiplePills = () => {
    setMultiplePillsModalOpen(false);
    setMultiplePillsMedication(null);
  };

  const handleOpenSideEffect = (medication: Medication) => {
    setSideEffectMedication(medication);
    setSideEffectModalOpen(true);
  };

  const handleCloseSideEffect = () => {
    setSideEffectModalOpen(false);
    setSideEffectMedication(null);
  };

  const handleOpenWithdrawal = (medication: Medication) => {
    setWithdrawalMedication(medication);
    setWithdrawalModalOpen(true);
  };

  const handleCloseWithdrawal = () => {
    setWithdrawalModalOpen(false);
    setWithdrawalMedication(null);
  };

  const handleOpenDependency = (medication: Medication) => {
    setDependencyMedication(medication);
    setDependencyModalOpen(true);
  };

  const handleCloseDependency = () => {
    setDependencyModalOpen(false);
    setDependencyMedication(null);
  };

  const handleResumeTapering = (medicationId: string) => {
    resumeTaperingSchedule(medicationId);
    toast.success('Tapering schedule resumed');
  };

  const MedicationCard = ({ medication }: { medication: Medication }) => {
    const adherence = getMedicationAdherence(medication.id, 7);
    const [showActions, setShowActions] = React.useState(false);
    const currentDose = getCurrentDose(medication.id);
    
    const getRiskIcon = (riskLevel: string) => {
      switch (riskLevel) {
        case 'high':
          return <ShieldAlert className="h-4 w-4 text-red-500" />;
        case 'moderate':
          return <AlertCircle className="h-4 w-4 text-yellow-500" />;
        case 'low':
          return <Shield className="h-4 w-4 text-blue-500" />;
        default:
          return <Shield className="h-4 w-4 text-green-500" />;
      }
    };

    const getRiskColor = (riskLevel: string) => {
      switch (riskLevel) {
        case 'high':
          return 'text-red-600 bg-red-50 border-red-200';
        case 'moderate':
          return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'low':
          return 'text-blue-600 bg-blue-50 border-blue-200';
        default:
          return 'text-green-600 bg-green-50 border-green-200';
      }
    };

    return (
      <div className="card hover:shadow-md transition-shadow">
        <div className="card-content p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div
                className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: medication.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {medication.name}
                  </h3>
                  {!medication.isActive && (
                    <span className="badge bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                  <span className={cn(
                    'badge',
                    medication.category === 'prescription' ? 'badge-primary' :
                    medication.category === 'over-the-counter' ? 'badge-success' :
                    medication.category === 'supplement' ? 'badge-warning' :
                    'badge-secondary'
                  )}>
                    {medication.category.replace('-', ' ')}
                  </span>
                  {/* Risk Level Indicator */}
                  <div className={cn('flex items-center space-x-1 px-2 py-1 rounded-md border text-xs font-medium', getRiskColor(medication.riskLevel))}>
                    {getRiskIcon(medication.riskLevel)}
                    <span>{medication.riskLevel} risk</span>
                  </div>
                </div>
                
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-gray-600">
                    <strong>Dosage:</strong> {medication.useMultiplePills ? formatPillDisplay(medication) : formatDosage(medication.dosage, medication.unit)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Frequency:</strong> {formatFrequency(medication.frequency)}
                  </p>
                  {/* Current Dose Information (Cyclic/Tapering) */}
                  {currentDose.phase !== 'maintenance' && (
                    <div className="flex items-center space-x-1 text-sm">
                      <Activity className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 font-medium">
                        Current: {currentDose.dose} {medication.unit} ({currentDose.phase})
                      </span>
                      {currentDose.message && (
                        <span className="text-gray-500 text-xs">• {currentDose.message}</span>
                      )}
                    </div>
                  )}
                  {medication.tapering && (
                    <div className="flex items-center space-x-1 text-sm">
                      <TrendingDown className="h-3 w-3 text-orange-500" />
                      <span className="text-orange-600 font-medium">Tapering schedule active</span>
                    </div>
                  )}
                  {medication.notes && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      <strong>Notes:</strong> {medication.notes}
                    </p>
                  )}
                </div>

                {medication.isActive && (
                  <div className="mt-3 flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-gray-600">
                        {adherence}% adherence (7 days)
                      </span>
                    </div>
                    {(() => {
                      // Calculate current pill count from inventory or fallback to pillsRemaining
                      let totalPills = 0;
                      if (medication.pillInventory && medication.pillInventory.length > 0) {
                        totalPills = medication.pillInventory.reduce((sum, item) => sum + item.currentCount, 0);
                      } else if (medication.pillsRemaining !== undefined) {
                        totalPills = medication.pillsRemaining;
                      }
                      
                      return totalPills > 0 ? (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-gray-600">
                            {totalPills} pills left
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              
              {showActions && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleEditMedication(medication);
                        setShowActions(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleToggleActive(medication.id);
                        setShowActions(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      {medication.isActive ? (
                        <>
                          <AlertCircle className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </button>
                    {(medication.riskLevel === 'high' || medication.riskLevel === 'moderate') && (
                      <button
                        onClick={() => {
                          updateRiskAssessment(medication.id);
                          setShowActions(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                      >
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        Assess Risk
                      </button>
                    )}
                    {medication.dependencyRiskCategory !== 'low-risk' && (
                      <button
                        onClick={() => {
                          handleOpenDependency(medication);
                          setShowActions(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Dependency Dashboard
                      </button>
                    )}
                    {(() => {
                      const medicationData = getMedicationByName(medication.name);
                      const isTapering = medication.tapering?.isActive;
                      const isPaused = medication.tapering?.isPaused;
                      
                      // Enhanced visibility: Show tapering options for more medications
                      if (!medicationData?.taperingRequired && !isTapering) {
                        // Show setup option for high-risk medications even if not flagged as requiring tapering
                        if (medication.riskLevel === 'high' || medication.riskLevel === 'moderate') {
                          return (
                            <button
                              onClick={() => {
                                handleOpenTaperingPlan(medication);
                                setShowActions(false);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                            >
                              <Coffee className="h-4 w-4 mr-2" />
                              Setup Break Option
                            </button>
                          );
                        }
                        return null;
                      }
                      
                      if (isTapering && isPaused) {
                        return (
                          <button
                            onClick={() => {
                              handleResumeTapering(medication.id);
                              setShowActions(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume Tapering
                          </button>
                        );
                      }
                      
                      if (isTapering && !isPaused) {
                        return (
                          <button
                            onClick={() => {
                              handlePauseTapering(medication);
                              setShowActions(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                          >
                            <Coffee className="h-4 w-4 mr-2" />
                            Take a Break
                          </button>
                        );
                      }
                      
                      return (
                        <button
                          onClick={() => {
                            handleOpenTaperingPlan(medication);
                            setShowActions(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Create Tapering Plan
                        </button>
                      );
                    })()}
                    {/* Multiple Pills Option */}
                    {!medication.useMultiplePills && (
                      <button
                        onClick={() => {
                          handleOpenMultiplePills(medication.id);
                          setShowActions(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                      >
                        <div className="flex items-center mr-2">
                          <Pill className="h-3 w-3" />
                          <Pill className="h-3 w-3 -ml-1" />
                        </div>
                        Multiple Pills Setup
                      </button>
                    )}
                    {medication.useMultiplePills && (
                      <button
                        onClick={() => {
                          handleOpenMultiplePills(medication.id);
                          setShowActions(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                      >
                        <div className="flex items-center mr-2">
                          <Pill className="h-3 w-3" />
                          <Pill className="h-3 w-3 -ml-1" />
                        </div>
                        Edit Multiple Pills Setup
                        <span className="ml-auto text-xs text-green-500">✓</span>
                      </button>
                    )}
                    
                    <button
                      onClick={() => {
                        handleOpenSideEffect(medication);
                        setShowActions(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Report Side Effect
                    </button>

                    {medication.dependencyRiskCategory !== 'low-risk' && (
                      <button
                        onClick={() => {
                          handleOpenWithdrawal(medication);
                          setShowActions(false);
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Track Withdrawal
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setConfirmDelete(medication.id);
                        setShowActions(false);
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your medications and prescriptions
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleAddMedication}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search medications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as MedicationCategory | 'all')}
            className="input w-auto"
          >
            <option value="all">All Categories</option>
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

      {/* Medications List */}
      {filteredMedications.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            {searchTerm || selectedCategory !== 'all' ? 'No medications found' : 'No medications yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first medication.'
            }
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <div className="mt-6">
              <button onClick={handleAddMedication} className="btn-primary">
                Add Your First Medication
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Medications */}
          {activeMedications.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Active Medications ({activeMedications.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeMedications.map((medication) => (
                  <MedicationCard key={medication.id} medication={medication} />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Medications */}
          {inactiveMedications.length > 0 && (
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Inactive Medications ({inactiveMedications.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveMedications.map((medication) => (
                  <MedicationCard key={medication.id} medication={medication} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medication Modal */}
      <MedicationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        medication={editingMedication}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteMedication(confirmDelete)}
        title="Delete Medication"
        message="Are you sure you want to delete this medication? This action cannot be undone and will remove all associated logs and reminders."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Tapering Plan Modal */}
      {taperingMedication && (
        <TaperingPlanModal
          isOpen={taperingModalOpen}
          onClose={() => {
            setTaperingModalOpen(false);
            setTaperingMedication(null);
          }}
          medication={taperingMedication}
        />
      )}

      {/* Pause Tapering Modal */}
      {pauseModalOpen && pauseMedication && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setPauseModalOpen(false)} />
            
            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <Coffee className="h-6 w-6 text-orange-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Take a Break from Tapering
                  </h3>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Pausing your tapering schedule for {pauseMedication.name} is completely normal and safe. 
                  How are you feeling with withdrawal symptoms?
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleConfirmPause('mild')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300"
                  >
                    <div className="font-medium text-green-800">Mild symptoms</div>
                    <div className="text-sm text-green-600">Suggested break: 3-6 days</div>
                  </button>
                  
                  <button
                    onClick={() => handleConfirmPause('moderate')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-300"
                  >
                    <div className="font-medium text-orange-800">Moderate symptoms</div>
                    <div className="text-sm text-orange-600">Suggested break: 1-2 weeks</div>
                  </button>
                  
                  <button
                    onClick={() => handleConfirmPause('severe')}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300"
                  >
                    <div className="font-medium text-red-800">Severe symptoms</div>
                    <div className="text-sm text-red-600">Suggested break: 2-4 weeks</div>
                  </button>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Remember:</strong> Taking breaks during tapering is encouraged and safe. 
                    Your schedule will automatically extend to account for the pause time.
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={() => setPauseModalOpen(false)}
                  className="w-full justify-center rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-300 sm:ml-3 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multiple Pills Setup Modal */}
      {multiplePillsModalOpen && multiplePillsMedication && (
        <MultiplePillSelector
          medicationId={multiplePillsMedication}
          onClose={handleCloseMultiplePills}
        />
      )}

      {sideEffectModalOpen && sideEffectMedication && (
        <SideEffectReportModal
          isOpen={sideEffectModalOpen}
          onClose={handleCloseSideEffect}
          medication={sideEffectMedication}
        />
      )}

      {withdrawalModalOpen && withdrawalMedication && (
        <WithdrawalTrackingModal
          isOpen={withdrawalModalOpen}
          onClose={handleCloseWithdrawal}
          medication={withdrawalMedication}
        />
      )}

      {dependencyModalOpen && dependencyMedication && (
        <DependencyPreventionModal
          isOpen={dependencyModalOpen}
          onClose={handleCloseDependency}
          medication={dependencyMedication}
        />
      )}
    </div>
  );
}
