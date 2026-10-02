import os
import sys

# Ensure backend directory is in python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app, init_db_safely
from app.database import SessionLocal
from app.models import User, Student, AttendanceRecord
from app.routes.auth import create_access_token

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("RUNNING VERIFICATION: REMOVE ALL STUDENTS & NO SEEDING")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Get Master Admin
        initial_admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@francisxavier.ac.in").strip().lower()
        master_admin = db.query(User).filter(User.role == "ADMIN", User.email == initial_admin_email).first()
        if not master_admin:
            master_admin = db.query(User).filter(User.role == "ADMIN").first()
        assert master_admin, "Master admin must exist"
        
        master_token = create_access_token(data={"sub": master_admin.email, "role": "ADMIN"})
        master_headers = {"Authorization": f"Bearer {master_token}"}
        
        # 1. Clean out all students using the new DELETE /api/students/all endpoint
        print("\n--- Cleaning database using DELETE /api/students/all ---")
        del_all_res = client.delete("/api/students/all", headers=master_headers)
        assert del_all_res.status_code == 200, f"Failed delete all: {del_all_res.text}"
        print(f"Delete All Response: {del_all_res.json()}")
        
        # TEST 1: Fresh / clean database -> 0 students
        print("\n--- TEST 1: Verify 0 students in database ---")
        res = client.get("/api/master-admin/students", headers=master_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["students"]) == 0, f"Expected 0 students, got {len(data['students'])}"
        assert data["stats"]["total_students"] == 0
        assert data["stats"]["active_students"] == 0
        assert data["stats"]["inactive_students"] == 0
        print("[PASS] TEST 1: Exactly 0 students in database. Stats all 0.")
        
        # TEST 2: Restart backend (run init_db_safely) -> Still 0 students
        print("\n--- TEST 2: Simulate Backend Restart ---")
        init_db_safely()
        res = client.get("/api/master-admin/students", headers=master_headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["students"]) == 0, f"Expected 0 students after restart, got {len(data['students'])}"
        print("[PASS] TEST 2: Restart did NOT recreate any default/seed students. Total = 0.")
        
        # TEST 3: Admin adds 1 student
        print("\n--- TEST 3: Admin -> Add Student ---")
        student_payload = {
            "name": "Kavitha S",
            "register_number": "950725101001",
            "email": "kavitha.ug.25.ad@francisxavier.ac.in",
            "phone": "9876543210",
            "department": "Computer Science & Engineering (CSE)",
            "year": "1st Year (I)",
            "status": "Active"
        }
        add_res = client.post("/api/students", json=student_payload, headers=master_headers)
        assert add_res.status_code == 201, f"Failed to add student: {add_res.text}"
        created_student = add_res.json()
        print(f"[PASS] TEST 3: Student created: ID={created_student['id']}, Name={created_student['name']}")
        
        # TEST 4: Refresh Students Page -> Exactly 1 student
        print("\n--- TEST 4: Refresh Students Page ---")
        res = client.get("/api/students", headers=master_headers)
        assert res.status_code == 200
        students_list = res.json()
        assert len(students_list) == 1, f"Expected 1 student, got {len(students_list)}"
        assert students_list[0]["email"] == "kavitha.ug.25.ad@francisxavier.ac.in"
        print("[PASS] TEST 4: Refreshed page shows exactly 1 student.")
        
        # TEST 5: Restart Application -> Still 1 student
        print("\n--- TEST 5: Restart Application ---")
        init_db_safely()
        res = client.get("/api/students", headers=master_headers)
        assert res.status_code == 200
        students_list = res.json()
        assert len(students_list) == 1
        print("[PASS] TEST 5: After restart, exactly 1 student persists.")
        
        # Verify student CAN log in while active
        print("\n--- Verify Student Login While Active ---")
        student_login_res = client.post("/api/auth/login", json={
            "email": "kavitha.ug.25.ad@francisxavier.ac.in",
            "device_id": "test_device_uuid_999",
            "device_name": "Test Browser"
        })
        assert student_login_res.status_code == 200, f"Login failed: {student_login_res.text}"
        student_token = student_login_res.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        print("[PASS] Student successfully logged in and obtained JWT.")
        
        # TEST 6: Student CANNOT call Remove All (Authorization Check)
        print("\n--- TEST 6: Student Authorization Test ---")
        unauthorized_res = client.delete("/api/students/all", headers=student_headers)
        assert unauthorized_res.status_code in [401, 403], f"Expected 401/403, got {unauthorized_res.status_code}"
        print("[PASS] TEST 6: Normal student is BLOCKED from calling /api/students/all.")
        
        # TEST 7: Confirm Remove All by Admin
        print("\n--- TEST 7: Admin calls DELETE /api/students/all ---")
        del_all_res = client.delete("/api/students/all", headers=master_headers)
        assert del_all_res.status_code == 200
        del_data = del_all_res.json()
        assert del_data["deleted_count"] >= 1
        print(f"[PASS] TEST 7: Confirmed Remove All: {del_data['message']}")
        
        # Verify 0 students now
        res = client.get("/api/students", headers=master_headers)
        assert res.status_code == 200
        assert len(res.json()) == 0, f"Expected 0 students, got {len(res.json())}"
        print("[PASS] Students list is now empty (Total = 0).")
        
        # TEST 8: Restart Application -> Still 0 students
        print("\n--- TEST 8: Restart Application ---")
        init_db_safely()
        res = client.get("/api/students", headers=master_headers)
        assert res.status_code == 200
        assert len(res.json()) == 0
        print("[PASS] TEST 8: Restarted application, still exactly 0 students. No default students recreated!")
        
        # TEST 9: Student Login after delete
        print("\n--- TEST 9: Student Login After Delete ---")
        login_after_del = client.post("/api/auth/login", json={
            "email": "kavitha.ug.25.ad@francisxavier.ac.in",
            "device_id": "test_device_uuid_999",
            "device_name": "Test Browser"
        })
        assert login_after_del.status_code == 403, f"Expected 403, got {login_after_del.status_code}"
        expected_msg = "Student account not found. Please contact your administrator."
        assert login_after_del.json().get("detail") == expected_msg, f"Got: {login_after_del.json()}"
        print(f"[PASS] TEST 9: Login rejected with: '{expected_msg}'")
        
        # Verify cached JWT is also rejected
        print("\n--- Verify Cached / localStorage JWT Rejection ---")
        cached_token_res = client.get("/api/auth/me", headers=student_headers)
        assert cached_token_res.status_code == 401, f"Expected 401, got {cached_token_res.status_code}"
        print(f"[PASS] Cached token rejected with 401: {cached_token_res.json().get('detail')}")
        
        # Clean up any leftover test User row for Kavitha
        db.query(User).filter(User.email == "kavitha.ug.25.ad@francisxavier.ac.in").delete(synchronize_session=False)
        db.commit()
        
        print("\n" + "=" * 60)
        print("ALL TESTS 1-9 PASSED WITH 100% SUCCESS!")
        print("=" * 60)
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
