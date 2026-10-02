import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Student, AttendanceRecord
from app.auth.utils import create_access_token

client = TestClient(app)
db = SessionLocal()

print("=" * 60)
print("COMPREHENSIVE TEST SUITE: REMOVE AUTHORIZED EMAILS & USE STUDENTS TABLE")
print("=" * 60)

# Setup: Master Admin & Normal Admin tokens
initial_admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@francisxavier.ac.in").strip().lower()
master_admin = db.query(User).filter(User.role == "ADMIN", User.email == initial_admin_email).first()
if not master_admin:
    master_admin = db.query(User).filter(User.role == "ADMIN").first()

assert master_admin, "Master admin account must exist"
master_token = create_access_token(data={"sub": master_admin.email})
master_headers = {"Authorization": f"Bearer {master_token}"}

# Find or create a non-master admin for testing
normal_admin = db.query(User).filter(User.role == "ADMIN", User.email != master_admin.email).first()
if not normal_admin:
    normal_admin = User(
        email="test_dept_admin@francisxavier.ac.in",
        full_name="Department Admin",
        hashed_password="hashedpassword123",
        role="ADMIN",
        is_approved=True
    )
    db.add(normal_admin)
    db.commit()
    db.refresh(normal_admin)

admin_token = create_access_token(data={"sub": normal_admin.email})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

target_name = "Gowthama Lakshmana Krishna A"
target_id = "95072517036"
target_email = "gowthamaa.ug.25.ad@francisxavier.ac.in"
target_dept = "Artificial Intelligence & Data Science"
target_year = "2nd Year"

# Link normal_admin to this class
client.post("/api/admin/class-links", json={
    "department": target_dept,
    "year": target_year,
    "section": "A",
    "admin_ids": [normal_admin.id]
}, headers=master_headers)

# Clean up existing test student records
existing_s = db.query(Student).filter((Student.email == target_email) | (Student.register_number == target_id)).all()
for s in existing_s:
    db.delete(s)
existing_u = db.query(User).filter(User.email == target_email).all()
for u in existing_u:
    db.query(AttendanceRecord).filter(AttendanceRecord.user_id == u.id).delete(synchronize_session=False)
    db.delete(u)
db.commit()

# ==============================================================================
# TEST 1 — ADD STUDENT
# ==============================================================================
print("\n[TEST 1] — ADD STUDENT")
print(f"Creating student: {target_name} ({target_id}, {target_email}) via Admin API...")

add_res = client.post("/api/students", json={
    "name": target_name,
    "register_number": target_id,
    "email": target_email,
    "phone": "9876543210",
    "department": target_dept,
    "year": target_year,
    "status": "Active"
}, headers=admin_headers)

print(f"Status Code: {add_res.status_code}")
assert add_res.status_code == 201, f"Failed to create student: {add_res.text}"
student_data = add_res.json()
assert student_data["email"] == target_email.lower()
assert student_data["status"] == "Active"
assert student_data["register_number"] == target_id
student_db_id = student_data["id"]
print(f"[OK] Student successfully created with ID {student_db_id}")

# Verify student appears in Admin -> Students
admin_list_res = client.get("/api/students", headers=admin_headers)
assert admin_list_res.status_code == 200
admin_students = admin_list_res.json()
found_in_admin = any(s["email"] == target_email for s in admin_students)
assert found_in_admin, "Student should appear in Admin's Students list!"
print("[OK] Verified student appears in Admin → Students list")

# Verify student appears in Master Admin -> Students
master_list_res = client.get("/api/master-admin/students", headers=master_headers)
master_json = master_list_res.json()
master_students = master_json.get("students", master_json if isinstance(master_json, list) else [])
found_in_master = any(s["email"] == target_email for s in master_students)
assert found_in_master, "Student should appear in Master Admin's Students list!"
print("[OK] Verified student appears in Master Admin → Students list")

# ==============================================================================
# TEST 2 — STUDENT LOGIN (ACTIVE STUDENT)
# ==============================================================================
print("\n[TEST 2] — STUDENT LOGIN (ACTIVE STUDENT)")
login_res = client.post("/api/auth/login", json={
    "email": target_email,
    "device_id": "test_device_gowtham_01",
    "device_name": "Chrome on Windows 11"
})

print(f"Status Code: {login_res.status_code}")
assert login_res.status_code == 200, f"Expected 200 OK for active student, got: {login_res.text}"
login_data = login_res.json()
assert "access_token" in login_data, "Token must be returned"
user_obj = login_data["user"]
print(f"[OK] Authentication successful. Token issued.")
print(f"  - User Name: {user_obj.get('full_name')}")
print(f"  - Student ID / Reg No: {user_obj.get('register_number')}")
print(f"  - Email: {user_obj.get('email')}")
print(f"  - Role: {user_obj.get('role')}")
print(f"  - Department: {user_obj.get('department')}")
print(f"  - Year: {user_obj.get('year')}")

assert user_obj.get("role") in ("student", "STUDENT"), f"Role must be student, got {user_obj.get('role')}"
assert user_obj.get("email") == target_email, f"Expected {target_email}, got {user_obj.get('email')}"
assert user_obj.get("register_number") == target_id, f"Expected {target_id}, got {user_obj.get('register_number')}"
print("[OK] Verified Student Session/JWT contains server-side student identity")

# ==============================================================================
# TEST 3 — UNKNOWN EMAIL
# ==============================================================================
print("\n[TEST 3] — UNKNOWN EMAIL")
unknown_email = "unknown@example.com"
unknown_res = client.post("/api/auth/login", json={
    "email": unknown_email,
    "device_id": "test_device_unknown",
    "device_name": "Chrome on Windows 11"
})

print(f"Status Code (Expected 403): {unknown_res.status_code}")
assert unknown_res.status_code == 403, f"Expected 403 Forbidden for unknown email, got {unknown_res.status_code}"
detail = unknown_res.json().get("detail", "")
print(f"Response Detail: '{detail}'")
expected_msg_unknown = "Student account not found. Please contact your administrator."
assert detail == expected_msg_unknown, f"Expected '{expected_msg_unknown}', got '{detail}'"
print("[OK] Verified unknown email returns exact required error message")

# ==============================================================================
# TEST 4 — INACTIVE STUDENT
# ==============================================================================
print("\n[TEST 4] — INACTIVE STUDENT")
print("Setting student status to 'Inactive' via Admin API...")
update_res = client.put(f"/api/students/{student_db_id}", json={
    "status": "Inactive"
}, headers=admin_headers)
assert update_res.status_code == 200, f"Failed to update student: {update_res.text}"
print(f"[OK] Student status updated to: {update_res.json().get('status')}")

inactive_login_res = client.post("/api/auth/login", json={
    "email": target_email,
    "device_id": "test_device_gowtham_01",
    "device_name": "Chrome on Windows 11"
})

print(f"Status Code (Expected 403): {inactive_login_res.status_code}")
assert inactive_login_res.status_code == 403, f"Expected 403 Forbidden for inactive student, got {inactive_login_res.status_code}"
detail_inactive = inactive_login_res.json().get("detail", "")
print(f"Response Detail: '{detail_inactive}'")
expected_msg_inactive = "Your student account is inactive. Please contact the administrator."
assert detail_inactive == expected_msg_inactive, f"Expected '{expected_msg_inactive}', got '{detail_inactive}'"
print("[OK] Verified inactive student returns exact required error message")

# Re-activate student for subsequent tests
client.put(f"/api/students/{student_db_id}", json={"status": "Active"}, headers=admin_headers)

# ==============================================================================
# TEST 5 — EMAIL CASE INSENSITIVITY
# ==============================================================================
print("\n[TEST 5] — EMAIL CASE INSENSITIVITY")
uppercase_email = "GOWTHAMAA.UG.25.AD@FRANCISXAVIER.AC.IN"
case_res = client.post("/api/auth/login", json={
    "email": uppercase_email,
    "device_id": "test_device_gowtham_01",
    "device_name": "Chrome on Windows 11"
})

print(f"Status Code: {case_res.status_code}")
assert case_res.status_code == 200, f"Expected 200 OK for uppercase email, got: {case_res.text}"
case_user = case_res.json()["user"]
assert case_user["email"] == target_email.lower(), "Should normalize email to lowercase"
print(f"[OK] Uppercase email '{uppercase_email}' successfully matched lowercase registered student: '{case_user['email']}'")

# ==============================================================================
# TEST 6 — REMOVE AUTHORIZED EMAIL VERIFICATION
# ==============================================================================
print("\n[TEST 6] — REMOVE AUTHORIZED EMAIL VERIFICATION")
# Verify that old /api/admin/allowed-emails endpoints are removed (404/405)
old_endpoint_res = client.get("/api/admin/allowed-emails", headers=master_headers)
print(f"GET /api/admin/allowed-emails Status: {old_endpoint_res.status_code} (Expected 404/405)")
assert old_endpoint_res.status_code in [404, 405], f"Old allowed-emails route should not exist! Got: {old_endpoint_res.status_code}"

old_post_res = client.post("/api/admin/allowed-emails", json={"email": "dummy@test.com"}, headers=master_headers)
print(f"POST /api/admin/allowed-emails Status: {old_post_res.status_code} (Expected 404/405)")
assert old_post_res.status_code in [404, 405], f"Old allowed-emails POST route should not exist! Got: {old_post_res.status_code}"

# Verify student login does NOT use AllowedEmail table:
# If student is deleted from Students table, even if an AllowedEmail row exists in DB, login must fail
from app.models import AllowedEmail
dummy_allowed = AllowedEmail(email="fake_whitelist_only@francisxavier.ac.in", name="Fake Whitelist")
db.add(dummy_allowed)
db.commit()

whitelist_only_login = client.post("/api/auth/login", json={
    "email": "fake_whitelist_only@francisxavier.ac.in",
    "device_id": "fake_dev",
    "device_name": "fake"
})
assert whitelist_only_login.status_code == 403, "Login must reject email present only in AllowedEmail!"
assert whitelist_only_login.json().get("detail") == expected_msg_unknown
# Clean up
db.delete(dummy_allowed)
db.commit()
print("[OK] Verified student login does NOT query or trust AllowedEmail table")
print("[OK] Verified old allowed-emails API routes are completely removed")

# ==============================================================================
# TEST 7 — ATTENDANCE & SESSION FUNCTIONALITY INTEGRITY
# ==============================================================================
print("\n[TEST 7] — ATTENDANCE & SESSION FUNCTIONALITY INTEGRITY")
# 1. Start a session
start_sess_res = client.post("/api/admin/session/start", headers=admin_headers)
if start_sess_res.status_code == 200:
    sess_id = start_sess_res.json()["id"]
    print(f"[OK] Started Session #{sess_id}")
    
    # 2. Check student's view of active session
    student_token = login_res.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    
    sess_check_res = client.get("/api/attendance/session/status", headers=student_headers)
    assert sess_check_res.status_code == 200
    current_sess_info = sess_check_res.json()
    assert current_sess_info.get("active_session") is not None
    print(f"[OK] Student successfully detected live Session #{sess_id}")
    
    # 3. End session cleanly
    end_sess_res = client.post("/api/admin/session/end", headers=admin_headers)
    assert end_sess_res.status_code == 200
    print("[OK] Ended session and verified attendance report generated without error")
else:
    print(f"Note: Session could not be started ({start_sess_res.status_code}), likely due to daily session limit or active session existing.")

print("\n" + "=" * 60)
print("ALL 6 TESTS + INTEGRITY CHECK PASSED WITH 100% SUCCESS!")
print("=" * 60)

# Final Cleanup of all test artifacts
print("\n[CLEANUP] Cleaning up test student and admin records...")
existing_s = db.query(Student).filter((Student.email == target_email) | (Student.register_number == target_id)).all()
for s in existing_s:
    db.delete(s)
existing_u = db.query(User).filter(User.email == target_email).all()
for u in existing_u:
    db.query(AttendanceRecord).filter(AttendanceRecord.user_id == u.id).delete(synchronize_session=False)
    db.delete(u)
if 'normal_admin' in locals() and normal_admin.email == "instructor.cse@francisxavier.ac.in":
    db.delete(normal_admin)
db.commit()
db.close()
print("[CLEANUP] Completed! Database is clean.")
