import { useMedicationStore } from '@/store';
import { generateId } from '@/utils/helpers';

/**
 * Utility function to fix Kratom medication data structure
 * This should be called from the browser console
 */
export function fixKratomData() {
  const store = useMedicationStore.getState();
  const kratom = store.medications.find(med => med.name === 'Kratom');
  
  if (!kratom) {
    console.error('❌ Kratom medication not found');
    return;
  }

  console.log('🔍 Current Kratom data:', kratom);

  // Fix the data structure
  if (kratom.useMultiplePills && kratom.pillConfigurations && kratom.pillConfigurations.length > 0) {
    const firstPillConfig = kratom.pillConfigurations[0];
    
    // Create proper dose configuration with pillComponents
    const fixedDoseConfig = {
      id: generateId(),
      name: 'Standard Dose',
      description: `5 pills of ${firstPillConfig.strength}${firstPillConfig.unit} each`,
      pillComponents: [
        {
          pillConfigurationId: firstPillConfig.id,
          quantity: 5 // 5 pills of 500mg = 2500mg total
        }
      ],
      totalDoseAmount: 2500,
      unit: 'mg',
      isActive: true
    };

    // Update the medication
    store.updateMedication(kratom.id, {
      doseConfigurations: [fixedDoseConfig],
      defaultDoseConfigurationId: fixedDoseConfig.id
    });

    console.log('✅ Fixed Kratom data structure!');
    console.log('🔄 Refresh the page to see the changes');
    return true;
  } else {
    console.error('❌ Kratom doesn\'t have proper pill configurations');
    return false;
  }
}

// Make it available globally for console access
(window as any).fixKratomData = fixKratomData;

