import { Activity, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

export function CyclicDosingDemo() {
  // Demo data for cyclic dosing patterns
  const demoPatterns = [
    {
      name: "5 Days On, 2 Days Off",
      description: "Take medication for 5 days, then 2-day break",
      currentPhase: "On Day 3",
      nextPhase: "Off period starts in 2 days",
      color: "blue"
    },
    {
      name: "Tapering Schedule", 
      description: "Gradual dose reduction over 4 weeks",
      currentPhase: "Week 2 - 75% dose",
      nextPhase: "Week 3 - 50% dose in 5 days",
      color: "orange"
    },
    {
      name: "Variable Dosing",
      description: "Higher dose on weekdays, lower on weekends",
      currentPhase: "Weekday dose (100%)",
      nextPhase: "Weekend dose (50%) in 2 days",
      color: "green"
    }
  ];

  const psychMessages = [
    {
      type: "encouragement",
      title: "You're staying strong! 💪",
      message: "Great job following your cyclic schedule. Consistency like this shows real commitment to your health.",
      icon: CheckCircle,
      color: "green"
    },
    {
      type: "reminder",
      title: "Off-day reminder 🌟",
      message: "Today is a medication-free day in your cycle. Use this time to focus on other healthy habits!",
      icon: Calendar,
      color: "blue"
    },
    {
      type: "dependency-warning",
      title: "Mindful check-in ⚖️",
      message: "We noticed you've been consistent with your schedule. Remember, this medication works best when taken exactly as prescribed.",
      icon: AlertTriangle,
      color: "yellow"
    }
  ];

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Advanced MedTrack Features Demo
        </h2>
        <p className="text-gray-600">
          Showcasing cyclic dosing, psychological messaging, and risk assessment
        </p>
      </div>

      {/* Cyclic Dosing Patterns */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="h-5 w-5 mr-2 text-blue-600" />
          Cyclic Dosing Patterns
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {demoPatterns.map((pattern, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{pattern.name}</h4>
                <div className={`h-3 w-3 rounded-full bg-${pattern.color}-500`}></div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{pattern.description}</p>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <span className="font-medium text-gray-700">Current:</span>
                  <span className="ml-2 text-gray-600">{pattern.currentPhase}</span>
                </div>
                <div className="flex items-center text-sm">
                  <span className="font-medium text-gray-700">Next:</span>
                  <span className="ml-2 text-gray-600">{pattern.nextPhase}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Psychological Messages */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
          Smart Psychological Messaging
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {psychMessages.map((message, index) => (
            <div key={index} className={`bg-white p-4 rounded-lg shadow-sm border-l-4 border-${message.color}-500`}>
              <div className="flex items-center mb-2">
                <message.icon className={`h-4 w-4 mr-2 text-${message.color}-600`} />
                <h4 className="font-medium text-gray-900">{message.title}</h4>
              </div>
              <p className="text-sm text-gray-600">{message.message}</p>
              <div className="mt-3">
                <span className={`text-xs px-2 py-1 rounded-full bg-${message.color}-100 text-${message.color}-700`}>
                  {message.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
          Risk Assessment Examples
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: "Oxycodone", risk: "high", category: "opioid", color: "red" },
            { name: "Alprazolam", risk: "high", category: "benzodiazepine", color: "red" },
            { name: "Zolpidem", risk: "moderate", category: "sleep-aid", color: "yellow" },
            { name: "Ibuprofen", risk: "minimal", category: "low-risk", color: "green" }
          ].map((med, index) => (
            <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
              <h4 className="font-medium text-gray-900 mb-2">{med.name}</h4>
              <div className="space-y-2">
                <div className={`flex items-center justify-between p-2 rounded bg-${med.color}-50`}>
                  <span className="text-sm font-medium">Risk Level</span>
                  <span className={`text-xs px-2 py-1 rounded-full bg-${med.color}-200 text-${med.color}-800`}>
                    {med.risk}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
                  Category: {med.category.replace('-', ' ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Summary */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Features Implemented</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Cyclic Dosing System</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• On/off cycles (e.g., 5 days on, 2 days off)</li>
              <li>• Tapering schedules with linear/exponential reduction</li>
              <li>• Variable dosing patterns</li>
              <li>• Holiday periods and custom schedules</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Psychological Messaging</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Positive reinforcement for good adherence</li>
              <li>• Gentle reminders without pressure</li>
              <li>• Dependency warnings for high-risk medications</li>
              <li>• Motivational boosts during difficult periods</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Risk Assessment</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Automatic categorization by dependency risk</li>
              <li>• Behavioral pattern detection</li>
              <li>• Early intervention for concerning usage</li>
              <li>• Real-time risk scoring algorithms</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-800">Smart Analytics</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Weekend gap detection</li>
              <li>• Timing irregularity analysis</li>
              <li>• Adherence trend monitoring</li>
              <li>• Personalized insights generation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
