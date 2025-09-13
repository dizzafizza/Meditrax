import React from 'react';
import { 
  Book, 
  Heart, 
  AlertTriangle, 
  TrendingDown, 
  Shield, 
  Users, 
  Phone, 
  ExternalLink,
  Pill,
  Calendar,
  BarChart3,
  Settings,
  ChevronRight,
  TestTube,
  Activity,
  Brain,
  Clock
} from 'lucide-react';

interface WikiSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
}

export function Wiki() {
  const [activeSection, setActiveSection] = React.useState<string>('overview');

  const sections: WikiSection[] = [
    {
      id: 'overview',
      title: 'Getting Started',
      icon: Book,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to MedTrack</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              MedTrack is a comprehensive medication tracking application designed to help you manage your medications safely, 
              track adherence, and access evidence-based harm reduction information. Whether you're managing prescription 
              medications, supplements, or other substances, MedTrack provides the tools you need for safer use.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Key Features</h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-center"><Pill className="h-4 w-4 mr-2" />Comprehensive medication database with harm reduction info</li>
                <li className="flex items-center"><Calendar className="h-4 w-4 mr-2" />Smart scheduling and reminder system</li>
                <li className="flex items-center"><BarChart3 className="h-4 w-4 mr-2" />Analytics and adherence tracking</li>
                <li className="flex items-center"><TrendingDown className="h-4 w-4 mr-2" />Evidence-based tapering plans</li>
                <li className="flex items-center"><Settings className="h-4 w-4 mr-2" />Privacy-focused with local data storage</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Quick Start Guide</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">1</div>
                <div>
                  <h4 className="font-medium">Add Your First Medication</h4>
                  <p className="text-gray-600">Go to Medications → Add Medication and search our comprehensive database or add custom entries.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">2</div>
                <div>
                  <h4 className="font-medium">Set Up Reminders</h4>
                  <p className="text-gray-600">Configure your dosing schedule and notification preferences for consistent tracking.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">3</div>
                <div>
                  <h4 className="font-medium">Track Your Progress</h4>
                  <p className="text-gray-600">Use the dashboard to log doses and monitor adherence patterns over time.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">4</div>
                <div>
                  <h4 className="font-medium">Review Analytics</h4>
                  <p className="text-gray-600">Analyze your patterns, identify trends, and get insights for better medication management.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'harm-reduction',
      title: 'Harm Reduction',
      icon: Shield,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Harm Reduction Principles</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              Harm reduction is a set of practical strategies aimed at reducing negative health, social, and legal impacts 
              associated with drug use. Our approach is non-judgmental and focuses on keeping you as safe as possible.
            </p>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center">
                <Heart className="h-5 w-5 mr-2" />
                Core Principles
              </h3>
              <ul className="space-y-2 text-green-800">
                <li>• Meet people where they are without judgment</li>
                <li>• Remove barriers to health services and information</li>
                <li>• Respect human dignity and individual autonomy</li>
                <li>• Focus on reducing harm rather than eliminating use</li>
                <li>• Provide evidence-based information and support</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <TestTube className="h-5 w-5 mr-2 text-blue-500" />
                  Substance Testing
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Use fentanyl test strips for all substances</li>
                  <li>• Test for adulterants with reagent kits</li>
                  <li>• Start with small amounts of any new batch</li>
                  <li>• Consider lab testing services when available</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Users className="h-5 w-5 mr-2 text-purple-500" />
                  Safe Use Practices
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Never use alone when possible</li>
                  <li>• Keep naloxone/Narcan readily available</li>
                  <li>• Stay hydrated and maintain nutrition</li>
                  <li>• Use in familiar, comfortable environments</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-red-500" />
                  Risk Reduction
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Avoid mixing substances (polydrug use)</li>
                  <li>• Use clean equipment and supplies</li>
                  <li>• Take regular breaks to prevent tolerance</li>
                  <li>• Monitor dosage and frequency patterns</li>
                </ul>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-orange-500" />
                  Mental Health
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Be aware of set and setting influences</li>
                  <li>• Avoid use during mental health crises</li>
                  <li>• Seek support when feeling isolated</li>
                  <li>• Practice self-care and stress management</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tapering',
      title: 'Tapering & Withdrawal',
      icon: TrendingDown,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Safe Tapering Practices</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              Tapering is the gradual reduction of a substance to minimize withdrawal symptoms and safely discontinue use. 
              MedTrack provides evidence-based tapering schedules for various substances.
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-red-900 mb-3 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Important Safety Notice
              </h3>
              <p className="text-red-800 text-sm">
                Never attempt to taper from alcohol, benzodiazepines, or barbiturates without medical supervision. 
                Withdrawal from these substances can be life-threatening and may cause seizures.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Tapering Methods</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Linear Tapering</h4>
                    <p className="text-gray-600 text-sm mb-2">Reduces by the same amount each step.</p>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <strong>Best for:</strong> Short-term medications, stable withdrawal patterns<br/>
                      <strong>Example:</strong> 100mg → 75mg → 50mg → 25mg → 0mg
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Hyperbolic Tapering</h4>
                    <p className="text-gray-600 text-sm mb-2">Reduces by percentage of current dose.</p>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <strong>Best for:</strong> Benzodiazepines, long-term medications<br/>
                      <strong>Example:</strong> 100mg → 90mg → 81mg → 73mg → 66mg...
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Exponential Tapering</h4>
                    <p className="text-gray-600 text-sm mb-2">Faster initial reduction, slower at end.</p>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <strong>Best for:</strong> When faster initial reduction is tolerated<br/>
                      <strong>Example:</strong> 100mg → 60mg → 40mg → 30mg → 25mg
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Withdrawal Management</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Preparation</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Consult healthcare provider</li>
                      <li>• Prepare support system</li>
                      <li>• Stock comfort medications</li>
                      <li>• Clear schedule for initial days</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Common Strategies</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Stay hydrated and maintain nutrition</li>
                      <li>• Use relaxation techniques</li>
                      <li>• Light exercise as tolerated</li>
                      <li>• Maintain sleep hygiene</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">When to Pause</h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>• Severe withdrawal symptoms</li>
                      <li>• Major life stressors</li>
                        <li>• Sleep disruption &gt; 5 days</li>
                      <li>• Suicidal ideation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-900 mb-3 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Using MedTrack for Tapering
              </h3>
              <ol className="space-y-2 text-yellow-800 text-sm">
                <li>1. Add your medication and current dose to MedTrack</li>
                <li>2. Navigate to the medication details and select "Create Tapering Plan"</li>
                <li>3. Review the suggested schedule based on your usage history</li>
                <li>4. Customize the plan if needed with your healthcare provider</li>
                <li>5. Track your progress and adjust the schedule as necessary</li>
                <li>6. Use the withdrawal symptom tracker to monitor your comfort level</li>
              </ol>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'emergency',
      title: 'Emergency Information',
      icon: Phone,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Emergency Resources</h2>
            
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
              <h3 className="font-bold text-red-900 mb-3 text-lg">🚨 Emergency Situations</h3>
              <p className="text-red-800 mb-3">Call emergency services immediately if experiencing:</p>
              <ul className="space-y-1 text-red-800 text-sm">
                <li>• Difficulty breathing or respiratory depression</li>
                <li>• Chest pain or heart palpitations</li>
                <li>• Seizures or convulsions</li>
                <li>• Loss of consciousness</li>
                <li>• Severe confusion or disorientation</li>
                <li>• Thoughts of self-harm or suicide</li>
              </ul>
              <div className="mt-4 p-3 bg-red-100 rounded">
                <p className="font-semibold text-red-900">Emergency Numbers:</p>
                <p className="text-red-800">🚑 Emergency Services: 911 (US) | 999 (UK) | 112 (EU)</p>
                <p className="text-red-800">☎️ Poison Control: 1-800-222-1222 (US)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Crisis Hotlines</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Suicide & Crisis Lifeline</p>
                    <p className="text-gray-600">988 (US) - 24/7 free and confidential support</p>
                  </div>
                  <div>
                    <p className="font-medium">Crisis Text Line</p>
                    <p className="text-gray-600">Text HOME to 741741</p>
                  </div>
                  <div>
                    <p className="font-medium">SAMHSA National Helpline</p>
                    <p className="text-gray-600">1-800-662-HELP (4357)</p>
                  </div>
                  <div>
                    <p className="font-medium">National Domestic Violence Hotline</p>
                    <p className="text-gray-600">1-800-799-7233</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Overdose Prevention</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Naloxone (Narcan) Access</p>
                    <p className="text-gray-600">Available at pharmacies without prescription in most areas</p>
                  </div>
                  <div>
                    <p className="font-medium">Never Use Alone Hotline</p>
                    <p className="text-gray-600">1-800-484-3731 - Stay on line while using</p>
                  </div>
                  <div>
                    <p className="font-medium">Good Samaritan Laws</p>
                    <p className="text-gray-600">Legal protection when calling for medical help</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">Treatment Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">Find Treatment</h4>
                  <ul className="space-y-1 text-blue-800">
                    <li>• SAMHSA Treatment Locator: findtreatment.gov</li>
                    <li>• Narcotics Anonymous: na.org</li>
                    <li>• Alcoholics Anonymous: aa.org</li>
                    <li>• SMART Recovery: smartrecovery.org</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Harm Reduction</h4>
                  <ul className="space-y-1 text-blue-800">
                    <li>• DanceSafe: dancesafe.org</li>
                    <li>• Erowid: erowid.org</li>
                    <li>• The Loop: wearetheloop.org</li>
                    <li>• TripSit: tripsit.me</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'app-guide',
      title: 'App User Guide',
      icon: Book,
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Complete App Guide</h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Pill className="h-5 w-5 mr-2 text-blue-500" />
                  Managing Medications
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="font-medium mb-3">Adding Medications</h4>
                  <ol className="space-y-2 text-gray-700 text-sm">
                    <li>1. Navigate to the Medications page</li>
                    <li>2. Click "Add Medication" button</li>
                    <li>3. Search our comprehensive database or add custom medication</li>
                    <li>4. Set dosage, frequency, and schedule details</li>
                    <li>5. Configure inventory tracking and refill reminders</li>
                    <li>6. Review harm reduction information and warnings</li>
                  </ol>
                  
                  <h4 className="font-medium mb-3 mt-6">Medication Categories</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-blue-50 p-2 rounded">Prescription</div>
                    <div className="bg-green-50 p-2 rounded">Over-the-Counter</div>
                    <div className="bg-purple-50 p-2 rounded">Supplements</div>
                    <div className="bg-yellow-50 p-2 rounded">Vitamins</div>
                    <div className="bg-orange-50 p-2 rounded">Herbal</div>
                    <div className="bg-red-50 p-2 rounded">Injection</div>
                    <div className="bg-pink-50 p-2 rounded">Topical</div>
                    <div className="bg-gray-50 p-2 rounded">Emergency</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-green-500" />
                  Scheduling & Reminders
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Frequency Options</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• As-needed (PRN)</li>
                        <li>• Once daily</li>
                        <li>• Twice daily</li>
                        <li>• Three times daily</li>
                        <li>• Every 4/6/8/12 hours</li>
                        <li>• Weekly schedules</li>
                        <li>• Custom intervals</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Reminder Features</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• Browser notifications</li>
                        <li>• Custom reminder times</li>
                        <li>• Missed dose alerts</li>
                        <li>• Refill reminders</li>
                        <li>• Calendar integration</li>
                        <li>• Snooze functionality</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
                  Analytics & Tracking
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Adherence Tracking</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• Daily adherence percentages</li>
                        <li>• Weekly/monthly trends</li>
                        <li>• Missed dose patterns</li>
                        <li>• Medication-specific insights</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Visual Reports</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• Line charts for trends</li>
                        <li>• Bar charts for comparisons</li>
                        <li>• Pie charts for breakdowns</li>
                        <li>• Heatmaps for patterns</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Smart Insights</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• Pattern recognition</li>
                        <li>• Risk factor identification</li>
                        <li>• Improvement suggestions</li>
                        <li>• Dependency monitoring</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="h-5 w-5 mr-2 text-gray-500" />
                  Privacy & Data Management
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Data Storage</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• All data stored locally in your browser</li>
                        <li>• No server uploads or cloud storage</li>
                        <li>• Complete control over your information</li>
                        <li>• HIPAA-compliant design principles</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Export & Backup</h4>
                      <ul className="space-y-1 text-gray-700 text-sm">
                        <li>• JSON export for full data backup</li>
                        <li>• CSV export for spreadsheet analysis</li>
                        <li>• Import/restore from backups</li>
                        <li>• Regular backup reminders</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Privacy First Design</h4>
                    <p className="text-green-800 text-sm">
                      MedTrack is designed with privacy as a core principle. Your sensitive medication and health data 
                      never leaves your device, ensuring complete confidentiality and control.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MedTrack Wiki</h1>
          <p className="text-gray-600">
            Comprehensive guides for safe medication management, harm reduction, and app usage
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-8">
              <h2 className="font-semibold text-gray-900 mb-4">Contents</h2>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <section.icon className={`h-4 w-4 ${
                        activeSection === section.id ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <span className="text-sm font-medium">{section.title}</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${
                      activeSection === section.id ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {sections.find(section => section.id === activeSection)?.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
