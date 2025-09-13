import React from 'react';
import { useForm } from 'react-hook-form';
import { 
  User, 
  Heart, 
  Shield, 
  Phone, 
  Mail, 
  AlertTriangle,
  Plus,
  X,
  Save,
  Edit2
} from 'lucide-react';
import { useMedicationStore } from '@/store';
import { UserProfile } from '@/types';
import { formatDate, isValidEmail, isValidPhone } from '@/utils/helpers';
import toast from 'react-hot-toast';

export function HealthProfile() {
  const { userProfile, updateProfile, createProfile, medications } = useMedicationStore();
  
  const [isEditing, setIsEditing] = React.useState(!userProfile);
  const [newAllergy, setNewAllergy] = React.useState('');
  const [newCondition, setNewCondition] = React.useState('');

  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<UserProfile>({
    defaultValues: userProfile || {
      name: '',
      dateOfBirth: undefined,
      allergies: [],
      conditions: [],
      emergencyContact: {
        name: '',
        relationship: '',
        phone: '',
        email: ''
      },
      preferences: {
        theme: 'system',
        notifications: {
          push: true,
          sound: true,
          vibration: true,
          reminderAdvance: 15,
        },
        privacy: {
          shareData: false,
          analytics: true,
        },
        display: {
          timeFormat: '12h',
          dateFormat: 'MM/DD/YYYY',
          defaultView: 'dashboard',
        },
      }
    }
  });

  const allergies = watch('allergies') || [];
  const conditions = watch('conditions') || [];
  // const emergencyContact = watch('emergencyContact');

  // Get medication-related insights
  const highRiskMedications = medications.filter(med => 
    med.isActive && (med.riskLevel === 'high' || med.riskLevel === 'moderate')
  );

  const medicationCategories = medications.reduce((acc, med) => {
    acc[med.category] = (acc[med.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  React.useEffect(() => {
    if (userProfile) {
      reset(userProfile);
    }
  }, [userProfile, reset]);

  const onSubmit = (data: UserProfile) => {
    if (userProfile) {
      updateProfile(data);
      toast.success('Profile updated successfully');
    } else {
      createProfile(data);
      toast.success('Profile created successfully');
    }
    setIsEditing(false);
  };

  const handleAddAllergy = () => {
    if (newAllergy.trim()) {
      const currentAllergies = allergies || [];
      setValue('allergies', [...currentAllergies, newAllergy.trim()]);
      setNewAllergy('');
    }
  };

  const handleRemoveAllergy = (index: number) => {
    const currentAllergies = allergies || [];
    setValue('allergies', currentAllergies.filter((_, i) => i !== index));
  };

  const handleAddCondition = () => {
    if (newCondition.trim()) {
      const currentConditions = conditions || [];
      setValue('conditions', [...currentConditions, newCondition.trim()]);
      setNewCondition('');
    }
  };

  const handleRemoveCondition = (index: number) => {
    const currentConditions = conditions || [];
    setValue('conditions', currentConditions.filter((_, i) => i !== index));
  };

  const handleCancel = () => {
    if (userProfile) {
      reset(userProfile);
      setIsEditing(false);
    }
  };

  if (!isEditing && userProfile) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Health Profile</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your personal health information and emergency contacts
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Profile Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Information */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
                </div>
              </div>
              <div className="card-content p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-sm text-gray-900">{userProfile.name || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(userProfile.dateOfBirth) !== 'N/A' 
                        ? formatDate(userProfile.dateOfBirth)
                        : 'Not provided'
                      }
                    </p>
                  </div>
                </div>

                {/* Allergies */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                  {userProfile.allergies && userProfile.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {userProfile.allergies.map((allergy, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {allergy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No allergies reported</p>
                  )}
                </div>

                {/* Medical Conditions */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medical Conditions</label>
                  {userProfile.conditions && userProfile.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {userProfile.conditions.map((condition, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          <Heart className="h-3 w-3 mr-1" />
                          {condition}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No medical conditions reported</p>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="card mt-6">
              <div className="card-header">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900">Emergency Contact</h3>
                </div>
              </div>
              <div className="card-content p-6">
                {userProfile.emergencyContact && userProfile.emergencyContact.name ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <p className="mt-1 text-sm text-gray-900">{userProfile.emergencyContact.name}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Relationship</label>
                      <p className="mt-1 text-sm text-gray-900">{userProfile.emergencyContact.relationship}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <div className="mt-1 flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-900">{userProfile.emergencyContact.phone}</p>
                      </div>
                    </div>
                    
                    {userProfile.emergencyContact.email && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <div className="mt-1 flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-900">{userProfile.emergencyContact.email}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No emergency contact information provided</p>
                )}
              </div>
            </div>
          </div>

          {/* Health Summary Sidebar */}
          <div className="space-y-6">
            {/* Medication Summary */}
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-medium text-gray-900">Medication Summary</h3>
              </div>
              <div className="card-content p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Active</span>
                    <span className="text-sm font-medium">{medications.filter(med => med.isActive).length}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">High Risk</span>
                    <span className="text-sm font-medium text-red-600">{highRiskMedications.length}</span>
                  </div>

                  {Object.entries(medicationCategories).length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">By Category</h4>
                      <div className="space-y-2">
                        {Object.entries(medicationCategories).map(([category, count]) => (
                          <div key={category} className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 capitalize">{category.replace('-', ' ')}</span>
                            <span className="text-xs font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Health Alerts */}
            {(userProfile.allergies?.length || highRiskMedications.length) && (
              <div className="card">
                <div className="card-header">
                  <h3 className="text-lg font-medium text-gray-900">Health Alerts</h3>
                </div>
                <div className="card-content p-6">
                  <div className="space-y-3">
                    {userProfile.allergies && userProfile.allergies.length > 0 && (
                      <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Known Allergies</p>
                          <p className="text-xs text-red-600">{userProfile.allergies.length} allergy(ies) on file</p>
                        </div>
                      </div>
                    )}
                    
                    {highRiskMedications.length > 0 && (
                      <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                        <Shield className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-orange-800">High-Risk Medications</p>
                          <p className="text-xs text-orange-600">{highRiskMedications.length} medication(s) require monitoring</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {userProfile ? 'Edit' : 'Create'} Health Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {userProfile 
              ? 'Update your personal health information' 
              : 'Set up your personal health information and emergency contacts'
            }
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
              </div>
            </div>
            <div className="card-content p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  {...register('name', { required: 'Name is required' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Your full name"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  {...register('dateOfBirth')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                />
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allergies
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    placeholder="Add an allergy"
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                  />
                  <button
                    type="button"
                    onClick={handleAddAllergy}
                    className="btn-secondary inline-flex items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {allergies && allergies.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {allergy}
                        <button
                          type="button"
                          onClick={() => handleRemoveAllergy(index)}
                          className="ml-1 text-red-600 hover:text-red-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Medical Conditions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Medical Conditions
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    placeholder="Add a medical condition"
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCondition())}
                  />
                  <button
                    type="button"
                    onClick={handleAddCondition}
                    className="btn-secondary inline-flex items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {conditions && conditions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {conditions.map((condition, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        {condition}
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(index)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">Emergency Contact</h3>
              </div>
            </div>
            <div className="card-content p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Contact Name
                </label>
                <input
                  type="text"
                  {...register('emergencyContact.name')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Emergency contact's name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Relationship
                </label>
                <input
                  type="text"
                  {...register('emergencyContact.relationship')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="e.g., Spouse, Parent, Sibling"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  {...register('emergencyContact.phone', {
                    validate: (value) => !value || isValidPhone(value) || 'Please enter a valid phone number'
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Phone number"
                />
                {errors.emergencyContact?.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.emergencyContact.phone.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  {...register('emergencyContact.email', {
                    validate: (value) => !value || isValidEmail(value) || 'Please enter a valid email address'
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="email@example.com"
                />
                {errors.emergencyContact?.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.emergencyContact.email.message}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          {userProfile && (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="btn-primary inline-flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{userProfile ? 'Update' : 'Create'} Profile</span>
          </button>
        </div>
      </form>
    </div>
  );
}
