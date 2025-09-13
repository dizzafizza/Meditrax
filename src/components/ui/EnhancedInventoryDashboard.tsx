import { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  ShoppingCart,
  Calendar,
  BarChart3,
  Settings
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { PersonalRefillService } from '@/services/smartRefillService';
import { formatDate } from '@/utils/helpers';
import { InventoryConfigModal } from '@/components/modals/InventoryConfigModal';
import { PharmacyInfo, PersonalMedicationTracking } from '@/types/enhanced-inventory';

interface InventoryInsight {
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  action?: string;
}

export function PersonalMedicationDashboard() {
  const { medications, logs } = useMedicationStore();
  const [insights, setInsights] = useState<InventoryInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [pharmacies, setPharmacies] = useState<PharmacyInfo[]>([]);
  const [trackingSettings, setTrackingSettings] = useState<PersonalMedicationTracking[]>([]);
  const [validPredictions, setValidPredictions] = useState<any[]>([]);

  useEffect(() => {
    // Load saved configuration
    try {
      const savedPharmacies = localStorage.getItem('medication-pharmacies');
      const savedTracking = localStorage.getItem('medication-tracking');
      
      if (savedPharmacies) {
        setPharmacies(JSON.parse(savedPharmacies));
      }
      if (savedTracking) {
        setTrackingSettings(JSON.parse(savedTracking));
      }
    } catch (error) {
      console.error('Error loading inventory config:', error);
    }

    analyzeInventoryStatus();
  }, [medications, logs]);

  const analyzeInventoryStatus = async () => {
    setIsLoading(true);
    
    try {
      // Filter to only medications that have trackable inventory
      const trackableMedications = medications.filter(med => {
        // Has inventory or legacy pill count
        const hasInventory = (med.pillInventory && med.pillInventory.length > 0) || 
                            (med.pillsRemaining !== undefined && med.pillsRemaining > 0);
        return med.isActive && hasInventory;
      });

      if (trackableMedications.length === 0) {
        setInsights([{
          type: 'info',
          title: 'No Trackable Medications',
          message: 'Enable "Multiple Pills" on your medications to start tracking inventory.',
          action: 'Go to Medications page'
        }]);
        setValidPredictions([]);
        setIsLoading(false);
        return;
      }

      // Analyze your medication needs with filtered medications
      const analysis = PersonalRefillService.analyzePersonalMedicationNeeds(
        trackableMedications,
        logs.filter(log => trackableMedications.some(med => med.id === log.medicationId)),
        trackingSettings // Use saved tracking settings
      );

      // Generate insights based on analysis
      const newInsights: InventoryInsight[] = [];

      // Only show meaningful alerts
      analysis.alerts.filter(alert => alert.daysRemaining >= 0).forEach(alert => {
        newInsights.push({
          type: alert.priority === 'urgent' ? 'error' : alert.priority === 'important' ? 'warning' : 'info',
          title: alert.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          message: alert.message,
          action: alert.suggestion
        });
      });

      // Show meaningful recommendations only
      const meaningfulRecommendations = analysis.recommendations.filter(rec => 
        !rec.includes('No medications') && !rec.includes('error')
      );
      
      meaningfulRecommendations.slice(0, 3).forEach(rec => {
        newInsights.push({
          type: 'info',
          title: 'Personal Insight',
          message: rec
        });
      });

      // Only show refill schedule if there are actual predictions
      const predictions = analysis.refillPredictions.filter(pred => 
        pred.confidence !== 'low' && pred.currentPillCount > 0
      );
      
      setValidPredictions(predictions);

      if (predictions.length > 0) {
        const refillSchedule = PersonalRefillService.generatePersonalRefillSchedule(
          trackableMedications,
          predictions
        );

        // Add urgent refills as insights
        refillSchedule.urgentRefills.forEach(refill => {
          newInsights.push({
            type: 'error',
            title: 'Urgent Refill Needed',
            message: `${refill.medication.name} - ${refill.reason}`,
            action: 'Get refill by ' + formatDate(refill.refillBy)
          });
        });

        // Add coordination opportunities
        refillSchedule.coordinationOpportunities.forEach(opportunity => {
          newInsights.push({
            type: 'success',
            title: 'Coordination Opportunity',
            message: `${opportunity.reason} for ${opportunity.medications.map(m => m.name).join(', ')}`,
            action: 'Plan refills for ' + formatDate(opportunity.bestDate)
          });
        });
      }

      // Add current inventory summary
      const totalMedications = trackableMedications.length;
      const medicationsWithLowStock = trackableMedications.filter(med => {
        const currentCount = (med.pillInventory?.reduce((sum, item) => sum + item.currentCount, 0) || med.pillsRemaining || 0);
        return currentCount <= 7; // Less than a week supply
      }).length;

      if (medicationsWithLowStock > 0) {
        newInsights.unshift({
          type: 'warning',
          title: 'Inventory Summary',
          message: `${medicationsWithLowStock} of ${totalMedications} medications running low (≤7 days supply)`,
          action: 'Review inventory below'
        });
      } else {
        newInsights.unshift({
          type: 'success',
          title: 'Inventory Status',
          message: `All ${totalMedications} tracked medications have adequate supply`,
          action: 'View details below'
        });
      }

      setInsights(newInsights);
    } catch (error) {
      console.error('Error analyzing inventory:', error);
      setInsights([{
        type: 'error',
        title: 'Analysis Error',
        message: 'Unable to analyze inventory status. Please try again.'
      }]);
      setValidPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'success': return <TrendingUp className="h-4 w-4 text-green-500" />;
      default: return <Package className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightBorderColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-orange-200 bg-orange-50';
      case 'success': return 'border-green-200 bg-green-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const handleInsightAction = (insight: InventoryInsight) => {
    // Handle different insight actions
    if (insight.action?.includes('Go to Medications')) {
      window.location.href = '/medications';
    } else if (insight.action?.includes('Get refill')) {
      // Show refill reminder
      alert(`📋 Reminder: ${insight.message}\n\nAction: ${insight.action}`);
    } else if (insight.action?.includes('Plan refills')) {
      // Show coordination opportunity
      alert(`🎯 Coordination Opportunity: ${insight.message}\n\nAction: ${insight.action}`);
    } else if (insight.action?.includes('Review inventory')) {
      // Scroll to medication details (if they exist)
      const medicationSection = document.querySelector('[data-testid="medication-details"]');
      if (medicationSection) {
        medicationSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (insight.action?.includes('View details')) {
      // Show detailed breakdown
      alert(`📊 Inventory Status: ${insight.message}\n\nYour medications have adequate supply. Keep up the good work!`);
    } else {
      // Generic action
      alert(`ℹ️ ${insight.title}: ${insight.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-2 mb-4">
            <div className="h-5 w-5 bg-gray-300 rounded"></div>
            <div className="h-4 w-32 bg-gray-300 rounded"></div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
            <h2 className="text-lg font-semibold text-gray-900">Personal Medication Tracker</h2>
            <p className="text-sm text-gray-600">
              Smart insights for your medication supply
            </p>
            </div>
          </div>
          <button 
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Configure</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <Package className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Active Medications</p>
              <p className="text-2xl font-bold text-gray-900">
                {medications.filter(med => med.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Alerts</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.type === 'error' || i.type === 'warning').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Refills Due</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.title === 'Urgent Refill').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-sm font-medium text-gray-600">Tips</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.filter(i => i.type === 'success').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights Feed */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Personal Insights & Recommendations</h3>
          <p className="text-sm text-gray-600 mt-1">
            Based on your usage patterns and current supply
          </p>
        </div>

        <div className="p-6">
          {insights.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No insights yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start tracking your medications to get helpful insights about your supply.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 ${getInsightBorderColor(insight.type)}`}
                >
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {insight.title}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        {insight.message}
                      </p>
                      {insight.action && (
                        <button 
                          onClick={() => handleInsightAction(insight)}
                          className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                        >
                          {insight.action} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Future Predictions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Refill Calendar</h3>
          <p className="text-sm text-gray-600 mt-1">
            When you'll likely need refills based on your usage
          </p>
        </div>

        <div className="p-6">
          {validPredictions.length > 0 ? (
            <div className="space-y-4">
              {validPredictions.slice(0, 5).map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{prediction.medicationName}</h4>
                    <p className="text-sm text-gray-600">
                      Expected empty: {prediction.estimatedEmptyDate.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {Math.ceil((prediction.estimatedEmptyDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                    </div>
                    <div className="text-xs text-gray-500">remaining</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No refill predictions available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add medications with inventory tracking to see refill predictions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      <InventoryConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        medications={medications}
        onSave={handleConfigSave}
        existingPharmacies={pharmacies}
        existingTracking={trackingSettings}
      />
    </div>
  );

  function handleConfigSave(newPharmacies: PharmacyInfo[], newTrackingSettings: PersonalMedicationTracking[]) {
    setPharmacies(newPharmacies);
    setTrackingSettings(newTrackingSettings);
    
    // Store in localStorage for persistence (in a real app, this would go to a database)
    localStorage.setItem('medication-pharmacies', JSON.stringify(newPharmacies));
    localStorage.setItem('medication-tracking', JSON.stringify(newTrackingSettings));
    
    // Refresh the analysis with new settings
    analyzeInventoryStatus();
  }
}
