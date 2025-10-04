import ActivityKit
import Foundation

/// Live Activity Attributes for Meditrax Effect Tracking
/// Based on Apple's ActivityKit documentation
/// Reference: https://developer.apple.com/documentation/activitykit/activityattributes
struct MeditraxLiveActivityAttributes: ActivityAttributes {
    /// Static content that doesn't change during the activity
    public struct ContentState: Codable, Hashable {
        // Medication information
        var medicationName: String
        var medicationDosage: String
        var medicationColor: String  // Hex color
        
        // Effect tracking state
        var currentPhase: String      // "pre_onset", "kicking_in", "peaking", "wearing_off", "worn_off"
        var minutesElapsed: Int
        var progress: Double          // 0.0 to 1.0
        var phaseDescription: String  // "Peak in 45 min"
        
        // Timeline milestones (in minutes from start)
        var onsetMinutes: Int
        var peakMinutes: Int
        var wearOffMinutes: Int
        var durationMinutes: Int
        
        // Update tracking
        var lastUpdated: Date
        
        // Helper computed properties
        var progressPercentage: Int {
            Int(progress * 100)
        }
        
        var timeRemaining: Int {
            max(0, durationMinutes - minutesElapsed)
        }
    }
    
    // Static attributes - set once when activity starts
    var medicationId: String
    var sessionId: String
    var startTime: Date
}

