import { PersonalMedicationDashboard } from '@/components/ui/EnhancedInventoryDashboard';

export function Inventory() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medication Inventory</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track your medication supply and get intelligent refill recommendations
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          <PersonalMedicationDashboard />
        </div>
      </div>
    </div>
  );
}
