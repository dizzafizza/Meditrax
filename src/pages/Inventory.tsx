import { PersonalMedicationDashboard } from '@/components/ui/EnhancedInventoryDashboard';

export function Inventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Medication Inventory</h1>
        <p className="text-gray-600 mt-1">
          Track your medication supply and get intelligent refill recommendations
        </p>
      </div>
      
      <PersonalMedicationDashboard />
    </div>
  );
}
