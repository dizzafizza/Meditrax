import Foundation
import Capacitor
import ActivityKit

/// Capacitor Plugin for iOS Live Activities
/// Bridges JavaScript calls to native ActivityKit
/// Reference: https://capacitorjs.com/docs/plugins/ios
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin {
    private var activeActivities: [String: Activity<MeditraxLiveActivityAttributes>] = [:]
    
    /// Start a new Live Activity
    /// @param call - Contains sessionId and state data
    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }
        
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in system settings")
            return
        }
        
        guard let sessionId = call.getString("sessionId"),
              let stateData = call.getObject("state") else {
            call.reject("Missing required parameters: sessionId, state")
            return
        }
        
        // Parse attributes (static data)
        let medicationId = stateData["medicationId"] as? String ?? ""
        
        let attributes = MeditraxLiveActivityAttributes(
            medicationId: medicationId,
            sessionId: sessionId,
            startTime: Date()
        )
        
        // Parse content state (dynamic data)
        let contentState = MeditraxLiveActivityAttributes.ContentState(
            medicationName: stateData["medicationName"] as? String ?? "Medication",
            medicationDosage: stateData["medicationDosage"] as? String ?? "",
            medicationColor: stateData["medicationColor"] as? String ?? "#3b82f6",
            currentPhase: stateData["currentPhase"] as? String ?? "pre_onset",
            minutesElapsed: stateData["minutesElapsed"] as? Int ?? 0,
            progress: stateData["progress"] as? Double ?? 0.0,
            phaseDescription: stateData["phaseDescription"] as? String ?? "Starting...",
            onsetMinutes: stateData["onsetMinutes"] as? Int ?? 30,
            peakMinutes: stateData["peakMinutes"] as? Int ?? 90,
            wearOffMinutes: stateData["wearOffMinutes"] as? Int ?? 180,
            durationMinutes: stateData["durationMinutes"] as? Int ?? 240,
            lastUpdated: Date()
        )
        
        // Request the Live Activity
        do {
            let activity = try Activity<MeditraxLiveActivityAttributes>.request(
                attributes: attributes,
                content: ActivityContent(state: contentState, staleDate: nil),
                pushType: nil
            )
            
            // Store activity reference
            activeActivities[sessionId] = activity
            
            call.resolve([
                "activityId": activity.id,
                "sessionId": sessionId,
                "success": true
            ])
            
            print("✅ Started Live Activity for session: \(sessionId)")
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
            print("❌ Failed to start Live Activity: \(error)")
        }
    }
    
    /// Update an existing Live Activity
    /// @param call - Contains activityId/sessionId and updated state
    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }
        
        guard let sessionId = call.getString("sessionId"),
              let stateData = call.getObject("state"),
              let activity = activeActivities[sessionId] else {
            call.reject("No active Live Activity found for this session")
            return
        }
        
        // Parse updated content state
        let contentState = MeditraxLiveActivityAttributes.ContentState(
            medicationName: stateData["medicationName"] as? String ?? "Medication",
            medicationDosage: stateData["medicationDosage"] as? String ?? "",
            medicationColor: stateData["medicationColor"] as? String ?? "#3b82f6",
            currentPhase: stateData["currentPhase"] as? String ?? "pre_onset",
            minutesElapsed: stateData["minutesElapsed"] as? Int ?? 0,
            progress: stateData["progress"] as? Double ?? 0.0,
            phaseDescription: stateData["phaseDescription"] as? String ?? "",
            onsetMinutes: stateData["onsetMinutes"] as? Int ?? 30,
            peakMinutes: stateData["peakMinutes"] as? Int ?? 90,
            wearOffMinutes: stateData["wearOffMinutes"] as? Int ?? 180,
            durationMinutes: stateData["durationMinutes"] as? Int ?? 240,
            lastUpdated: Date()
        )
        
        // Update the activity
        Task {
            await activity.update(
                ActivityContent(state: contentState, staleDate: nil)
            )
            
            call.resolve([
                "success": true,
                "phase": contentState.currentPhase,
                "elapsed": contentState.minutesElapsed
            ])
            
            print("✅ Updated Live Activity: \(contentState.currentPhase) at \(contentState.minutesElapsed)min")
        }
    }
    
    /// End a Live Activity
    /// @param call - Contains sessionId or activityId
    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }
        
        guard let sessionId = call.getString("sessionId"),
              let activity = activeActivities[sessionId] else {
            call.reject("No active Live Activity found for this session")
            return
        }
        
        // End the activity
        Task {
            let finalState = MeditraxLiveActivityAttributes.ContentState(
                medicationName: activity.content.state.medicationName,
                medicationDosage: activity.content.state.medicationDosage,
                medicationColor: activity.content.state.medicationColor,
                currentPhase: "worn_off",
                minutesElapsed: activity.content.state.minutesElapsed,
                progress: 1.0,
                phaseDescription: "Effects complete",
                onsetMinutes: activity.content.state.onsetMinutes,
                peakMinutes: activity.content.state.peakMinutes,
                wearOffMinutes: activity.content.state.wearOffMinutes,
                durationMinutes: activity.content.state.durationMinutes,
                lastUpdated: Date()
            )
            
            await activity.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .after(.now + 10) // Dismiss after 10 seconds
            )
            
            // Remove from active activities
            activeActivities.removeValue(forKey: sessionId)
            
            call.resolve(["success": true])
            
            print("✅ Ended Live Activity for session: \(sessionId)")
        }
    }
    
    /// Check if Live Activities are supported and enabled
    @objc func isSupported(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            let authInfo = ActivityAuthorizationInfo()
            call.resolve([
                "supported": true,
                "enabled": authInfo.areActivitiesEnabled,
                "frequentUpdatesEnabled": authInfo.areActivitiesEnabled
            ])
        } else {
            call.resolve([
                "supported": false,
                "enabled": false,
                "frequentUpdatesEnabled": false
            ])
        }
    }
    
    /// Get all active Live Activities
    @objc func getActive(_ call: CAPPluginCall) {
        if #available(iOS 16.2, *) {
            let activeIds = activeActivities.keys.map { String($0) }
            call.resolve([
                "count": activeActivities.count,
                "sessionIds": activeIds
            ])
        } else {
            call.resolve(["count": 0, "sessionIds": []])
        }
    }
}

