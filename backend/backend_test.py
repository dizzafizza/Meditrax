"""
Comprehensive backend API test suite for Meditrax.
CRITICAL FOCUS: Taper engine validation (the main bug fix).
"""
import requests
import sys
import time
from datetime import datetime

BASE_URL = "https://meds-reimagined.preview.emergentagent.com/api"

class MeditraxTester:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.med_id = None
        self.log_id = None
        self.taper_id = None
        self.cyclic_id = None
        self.reminder_id = None

    def test(self, name, method, endpoint, expected_status=200, data=None, params=None, validate=None):
        """Run a single API test with optional validation function."""
        self.tests_run += 1
        url = f"{BASE_URL}/{endpoint}"
        
        print(f"\n{'='*60}")
        print(f"TEST {self.tests_run}: {name}")
        print(f"{'='*60}")
        
        try:
            if method == "GET":
                resp = requests.get(url, params=params, timeout=30)
            elif method == "POST":
                resp = requests.post(url, json=data, timeout=30)
            elif method == "PUT":
                resp = requests.put(url, json=data, timeout=30)
            elif method == "DELETE":
                resp = requests.delete(url, timeout=30)
            else:
                raise ValueError(f"Unknown method: {method}")
            
            # Check status
            if resp.status_code != expected_status:
                self.tests_failed += 1
                msg = f"❌ FAILED: Expected {expected_status}, got {resp.status_code}"
                print(msg)
                print(f"Response: {resp.text[:500]}")
                self.failures.append(f"{name}: {msg}")
                return False, None
            
            # Parse JSON
            try:
                result = resp.json()
            except:
                result = resp.text
            
            # Custom validation
            if validate:
                try:
                    validate(result)
                except AssertionError as e:
                    self.tests_failed += 1
                    msg = f"❌ FAILED: Validation error: {str(e)}"
                    print(msg)
                    self.failures.append(f"{name}: {msg}")
                    return False, result
            
            self.tests_passed += 1
            print(f"✅ PASSED")
            return True, result
            
        except Exception as e:
            self.tests_failed += 1
            msg = f"❌ FAILED: Exception: {str(e)}"
            print(msg)
            self.failures.append(f"{name}: {msg}")
            return False, None

    def validate_taper_schedule(self, schedule, initial, final, method):
        """
        CRITICAL: Validate taper schedule meets all requirements.
        - Starts at initial_dose
        - Ends EXACTLY at final_dose
        - Monotonic non-increasing
        - No negative doses
        """
        steps = schedule.get("steps", [])
        assert len(steps) > 0, "Schedule has no steps"
        
        # Check first dose
        first_dose = steps[0]["dose"]
        assert abs(first_dose - initial) < 0.001, f"First dose {first_dose} != initial {initial}"
        
        # Check last dose
        last_dose = steps[-1]["dose"]
        assert abs(last_dose - final) < 0.001, f"Last dose {last_dose} != final {final}"
        
        # Check monotonic non-increasing
        for i in range(len(steps) - 1):
            curr = steps[i]["dose"]
            next_dose = steps[i + 1]["dose"]
            assert next_dose <= curr, f"Step {i}: dose increased from {curr} to {next_dose}"
        
        # Check no negative doses
        for i, step in enumerate(steps):
            dose = step["dose"]
            assert dose >= 0, f"Step {i}: negative dose {dose}"
        
        print(f"   ✓ Starts at {first_dose} (initial: {initial})")
        print(f"   ✓ Ends at {last_dose} (final: {final})")
        print(f"   ✓ Monotonic non-increasing ({len(steps)} steps)")
        print(f"   ✓ No negative doses")

    def run_all_tests(self):
        """Execute all test suites."""
        print("\n" + "="*60)
        print("MEDITRAX BACKEND TEST SUITE")
        print("="*60)
        
        # 1. Health check
        self.test("Health check with catalog count", "GET", "health",
                  validate=lambda r: (
                      assert_in("status", r),
                      assert_in("catalog_count", r),
                      print(f"   Catalog count: {r.get('catalog_count')}")
                  ))
        
        # 2. Catalog search
        success, results = self.test("Catalog search: 'sertra'", "GET", "catalog/search",
                                     params={"q": "sertra", "limit": 5})
        if success and results:
            print(f"   Found {len(results)} results")
            if len(results) > 0:
                print(f"   First result: {results[0].get('name')}")
        
        # 3. Create medication
        success, med = self.test("Create medication (Sertraline)", "POST", "medications",
                                 expected_status=200,
                                 data={
                                     "name": "Sertraline",
                                     "strength": 50,
                                     "unit": "mg",
                                     "category": "antidepressant",
                                     "frequency": "once_daily",
                                     "times": ["09:00"],
                                     "inventory": {
                                         "current_count": 30,
                                         "unit": "tablets",
                                         "units_per_dose": 1,
                                         "refill_threshold": 10
                                     }
                                 })
        if success and med:
            self.med_id = med.get("id")
            print(f"   Created med ID: {self.med_id}")
        
        # 4. Get medication
        if self.med_id:
            self.test(f"Get medication {self.med_id}", "GET", f"medications/{self.med_id}")
        
        # 5. List medications
        self.test("List medications", "GET", "medications")
        
        # 6. Create log (taken) - should decrement inventory
        if self.med_id:
            success, log = self.test("Create log (taken) - decrement inventory", "POST", "logs",
                                     data={
                                         "medication_id": self.med_id,
                                         "status": "taken",
                                         "dose_taken": 50,
                                         "unit": "mg",
                                         "decrement_inventory": True
                                     })
            if success and log:
                self.log_id = log.get("id")
                print(f"   Created log ID: {self.log_id}")
        
        # 7. Get logs
        self.test("Get logs", "GET", "logs")
        
        # 8. Get today
        success, today = self.test("Get today", "GET", "today")
        if success and today:
            summary = today.get("summary", {})
            print(f"   Today summary: {summary.get('taken')}/{summary.get('total')} doses, {summary.get('adherence')}% adherence")
        
        # 9. Get inventory
        success, inv = self.test("Get inventory", "GET", "inventory")
        if success and inv:
            print(f"   Inventory items: {len(inv)}")
            if len(inv) > 0:
                print(f"   First item: {inv[0].get('name')} - {inv[0].get('current_count')} {inv[0].get('unit')}")
        
        # 10. Get analytics
        success, analytics = self.test("Get analytics (30 days)", "GET", "analytics", params={"days": 30})
        if success and analytics:
            print(f"   Overall adherence: {analytics.get('overall_adherence')}%")
            print(f"   Current streak: {analytics.get('current_streak')} days")
        
        # ========================================
        # CRITICAL: TAPER ENGINE TESTS
        # ========================================
        print("\n" + "="*60)
        print("CRITICAL: TAPER ENGINE VALIDATION")
        print("="*60)
        
        # Test case 1: Linear 20->0 mg, 56 days, 7-day steps
        success, preview1 = self.test("Taper preview: Linear 20->0, 56d/7d", "POST", "taper/preview",
                                       data={
                                           "initial_dose": 20,
                                           "final_dose": 0,
                                           "method": "linear",
                                           "total_days": 56,
                                           "step_interval_days": 7,
                                           "unit": "mg"
                                       })
        if success and preview1:
            try:
                self.validate_taper_schedule(preview1, 20, 0, "linear")
            except AssertionError as e:
                print(f"   ❌ VALIDATION FAILED: {e}")
                self.failures.append(f"Taper linear 20->0: {e}")
        
        # Test case 2: Exponential 40->2 mg, 84 days, 14-day steps
        success, preview2 = self.test("Taper preview: Exponential 40->2, 84d/14d", "POST", "taper/preview",
                                       data={
                                           "initial_dose": 40,
                                           "final_dose": 2,
                                           "method": "exponential",
                                           "total_days": 84,
                                           "step_interval_days": 14,
                                           "unit": "mg"
                                       })
        if success and preview2:
            try:
                self.validate_taper_schedule(preview2, 40, 2, "exponential")
            except AssertionError as e:
                print(f"   ❌ VALIDATION FAILED: {e}")
                self.failures.append(f"Taper exponential 40->2: {e}")
        
        # Test case 3: Hyperbolic 10->0 mg, 70 days, 7-day steps
        success, preview3 = self.test("Taper preview: Hyperbolic 10->0, 70d/7d", "POST", "taper/preview",
                                       data={
                                           "initial_dose": 10,
                                           "final_dose": 0,
                                           "method": "hyperbolic",
                                           "total_days": 70,
                                           "step_interval_days": 7,
                                           "unit": "mg"
                                       })
        if success and preview3:
            try:
                self.validate_taper_schedule(preview3, 10, 0, "hyperbolic")
            except AssertionError as e:
                print(f"   ❌ VALIDATION FAILED: {e}")
                self.failures.append(f"Taper hyperbolic 10->0: {e}")
        
        # Test case 4: Hyperbolic 300->0 mg, 112 days, 14-day steps
        success, preview4 = self.test("Taper preview: Hyperbolic 300->0, 112d/14d", "POST", "taper/preview",
                                       data={
                                           "initial_dose": 300,
                                           "final_dose": 0,
                                           "method": "hyperbolic",
                                           "total_days": 112,
                                           "step_interval_days": 14,
                                           "unit": "mg"
                                       })
        if success and preview4:
            try:
                self.validate_taper_schedule(preview4, 300, 0, "hyperbolic")
            except AssertionError as e:
                print(f"   ❌ VALIDATION FAILED: {e}")
                self.failures.append(f"Taper hyperbolic 300->0: {e}")
        
        # 11. Create taper plan
        if self.med_id:
            success, taper = self.test("Create taper plan", "POST", "tapers",
                                       data={
                                           "medication_id": self.med_id,
                                           "initial_dose": 50,
                                           "final_dose": 0,
                                           "method": "hyperbolic",
                                           "total_days": 56,
                                           "step_interval_days": 7,
                                           "unit": "mg"
                                       })
            if success and taper:
                self.taper_id = taper.get("id")
                print(f"   Created taper ID: {self.taper_id}")
                # Validate the created taper schedule
                try:
                    self.validate_taper_schedule(taper.get("schedule", {}), 50, 0, "hyperbolic")
                except AssertionError as e:
                    print(f"   ❌ VALIDATION FAILED: {e}")
                    self.failures.append(f"Created taper plan: {e}")
        
        # 12. Get taper
        if self.taper_id:
            success, taper_detail = self.test(f"Get taper {self.taper_id}", "GET", f"tapers/{self.taper_id}")
            if success and taper_detail:
                print(f"   Current dose: {taper_detail.get('current_dose')}")
                print(f"   Current step: {taper_detail.get('current_step')}")
        
        # 13. List tapers
        self.test("List tapers", "GET", "tapers")
        
        # 14. Cyclic dosing
        if self.med_id:
            success, cyclic = self.test("Create cyclic plan", "POST", "cyclic",
                                        data={
                                            "medication_id": self.med_id,
                                            "name": "Weekend break",
                                            "type": "on-off-cycle",
                                            "pattern": [
                                                {"phase": "on", "duration": 5, "dose_multiplier": 1},
                                                {"phase": "off", "duration": 2, "dose_multiplier": 0}
                                            ]
                                        })
            if success and cyclic:
                self.cyclic_id = cyclic.get("id")
                print(f"   Created cyclic ID: {self.cyclic_id}")
        
        # 15. List cyclic
        self.test("List cyclic plans", "GET", "cyclic")
        
        # 16. Knowledge base
        success, kb = self.test("Knowledge base search: 'benzodiazepine'", "GET", "knowledge",
                                params={"q": "benzodiazepine", "limit": 5})
        if success and kb:
            print(f"   Found {len(kb)} articles")
        
        # 17. Knowledge categories
        success, cats = self.test("Knowledge categories", "GET", "knowledge/categories")
        if success and cats:
            print(f"   Categories: {', '.join(cats[:5])}")
        
        # 18. AI autofill (REAL GPT CALL - may take ~30s)
        print("\n⚠️  Testing AI autofill (real GPT call, may take ~30s)...")
        success, autofill = self.test("AI autofill: Modafinil", "POST", "knowledge/autofill",
                                      data={"name": "Modafinil"},
                                      validate=lambda r: (
                                          assert_in("medication", r),
                                          print(f"   Created: {r.get('created')}")
                                      ))
        
        # 19. AI suggestions
        success, sugg = self.test("AI suggestions", "GET", "ai/suggestions")
        if success and sugg:
            suggestions = sugg.get("suggestions", [])
            print(f"   Suggestions: {len(suggestions)}")
        
        # 20. AI chat (SSE stream - REAL GPT CALL)
        print("\n⚠️  Testing AI chat stream (real GPT call, may take ~30s)...")
        self.test_ai_chat_stream()
        
        # 21. Push endpoints
        success, vapid = self.test("Get VAPID public key", "GET", "push/vapid-public-key")
        if success and vapid:
            print(f"   VAPID key: {vapid.get('public_key')[:20]}...")
        
        # Test push with no subscriptions (should return 404)
        self.test("Test push (no subscriptions)", "POST", "push/test",
                  expected_status=404,
                  data={"title": "Test", "body": "Test notification"})
        
        # 22. Profile
        success, profile = self.test("Get profile", "GET", "profile")
        
        # Update profile
        self.test("Update profile", "PUT", "profile",
                  data={"name": "Test User", "allergies": ["penicillin"]})
        
        # 23. Settings
        success, settings = self.test("Get settings", "GET", "settings")
        
        # Update settings
        self.test("Update settings", "PUT", "settings",
                  data={"theme": "dark", "time_format": "24h"})
        
        # 24. Export
        success, export = self.test("Export data", "GET", "export")
        if success and export:
            print(f"   Exported collections: {', '.join(export.keys())}")
        
        # 25. Reminders
        if self.med_id:
            success, reminder = self.test("Create reminder", "POST", "reminders",
                                          data={
                                              "medication_id": self.med_id,
                                              "time": "09:00",
                                              "days_of_week": ["mon", "tue", "wed", "thu", "fri"]
                                          })
            if success and reminder:
                self.reminder_id = reminder.get("id")
        
        self.test("List reminders", "GET", "reminders")
        
        # Cleanup
        print("\n" + "="*60)
        print("CLEANUP")
        print("="*60)
        
        if self.reminder_id:
            self.test("Delete reminder", "DELETE", f"reminders/{self.reminder_id}")
        
        if self.cyclic_id:
            self.test("Delete cyclic plan", "DELETE", f"cyclic/{self.cyclic_id}")
        
        if self.taper_id:
            self.test("Delete taper", "DELETE", f"tapers/{self.taper_id}")
        
        if self.log_id:
            self.test("Delete log", "DELETE", f"logs/{self.log_id}")
        
        if self.med_id:
            self.test("Delete medication", "DELETE", f"medications/{self.med_id}")
        
        # Print summary
        self.print_summary()

    def test_ai_chat_stream(self):
        """Test AI chat SSE stream."""
        self.tests_run += 1
        print(f"\n{'='*60}")
        print(f"TEST {self.tests_run}: AI chat stream")
        print(f"{'='*60}")
        
        try:
            session_id = f"test-{int(time.time())}"
            url = f"{BASE_URL}/ai/chat"
            
            resp = requests.post(
                url,
                json={"session_id": session_id, "message": "What is sertraline?"},
                stream=True,
                timeout=35
            )
            
            if resp.status_code != 200:
                self.tests_failed += 1
                print(f"❌ FAILED: Status {resp.status_code}")
                self.failures.append(f"AI chat stream: Status {resp.status_code}")
                return
            
            # Read stream
            chunks = []
            for line in resp.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith('data:'):
                        chunks.append(line_str)
                        if len(chunks) >= 5:  # Just verify we get some chunks
                            break
            
            if len(chunks) > 0:
                self.tests_passed += 1
                print(f"✅ PASSED")
                print(f"   Received {len(chunks)} SSE chunks")
            else:
                self.tests_failed += 1
                print(f"❌ FAILED: No SSE chunks received")
                self.failures.append("AI chat stream: No chunks received")
                
        except Exception as e:
            self.tests_failed += 1
            print(f"❌ FAILED: {str(e)}")
            self.failures.append(f"AI chat stream: {str(e)}")

    def print_summary(self):
        """Print test summary."""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed} ✅")
        print(f"Failed: {self.tests_failed} ❌")
        
        if self.failures:
            print("\n" + "="*60)
            print("FAILURES:")
            print("="*60)
            for i, failure in enumerate(self.failures, 1):
                print(f"{i}. {failure}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\nSuccess rate: {success_rate:.1f}%")
        
        if self.tests_failed == 0:
            print("\n🎉 ALL TESTS PASSED!")
            return 0
        else:
            print(f"\n⚠️  {self.tests_failed} test(s) failed")
            return 1


def assert_in(key, data):
    """Helper to assert key exists in data."""
    assert key in data, f"Key '{key}' not found in response"


if __name__ == "__main__":
    tester = MeditraxTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
