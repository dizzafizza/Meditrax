import { PersonalMedicationDashboard } from '@/components/ui/EnhancedInventoryDashboard';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/react';

export function Inventory() {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle size="large">Medication Inventory</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="bg-gray-50">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div>
            <h1 className="mobile-title text-gray-900">Medication Inventory</h1>
            <p className="mobile-text text-gray-600 mt-1">
              Track your medication supply and get intelligent refill recommendations
            </p>
          </div>
        </div>
        
        {/* Content */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto mobile-scroll">
            <PersonalMedicationDashboard />
          </div>
        </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
