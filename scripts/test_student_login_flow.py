import sys
import os

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Student, AllowedEmail
from app.auth.utils import create_access_token

client = TestClient(app)
db = SessionLocal()

target_email = "gowthamaa.ug.25.ad@francisxavier.ac.in"

print(f"=== Testing Student Login Verification Flow for {target_email} ===")

# Step 1: Ensure target email is NOT in database
existing_s = db.query(Student).filter(Student.email == target_email).first()
if existing_s:
    db.delete(existing_s)
existing_u = db.query(User).filter(User.email == target_email).first()
if existing_u:
    db.delete(existing_u)
existing_a = db.query(AllowedEmail).filter(AllowedEmail.email == target_email).first()
if existing_a:
    db.delete(existing_a)
db.commit()

# Step 2: Student tries to login BEFORE being added
print("\n1. Student tries to login BEFORE Admin adds them:")
pre_login_res = client.post("/api/auth/login", json={
    "email": target_email,
    "full_name": "Gowtham A",
    "device_id": "test_device_gowtham_123",
    "device_name": "Chrome on Windows 11"
})
print("Status (Expected 403):", pre_login_res.status_code)
print("Response detail:", pre_login_res.json().get("detail"))
assert pre_login_res.status_code == 403, "Should reject unregistered student!"

# Step 3: Admin adds the student with status="Inactive"
print("\n2. Admin adds student with status='Inactive':")
master_admin = db.query(User).filter(User.role == "ADMIN", User.email == "admin@francisxavier.ac.in").first()
master_token = create_access_token(data={"sub": master_admin.email})
master_headers = {"Authorization": f"Bearer {master_token}"}

add_inactive_res = client.post("/api/students", json={
    "name": "Gowtham A",
    "register_number": "950825AD001",
    "email": target_email,
    "phone": "9876543210",
    "department": "Artificial Intelligence & Data Science (AIDS)",
    "year": "1st Year (I)",
    "status": "Inactive"
}, headers=master_headers)
assert add_inactive_res.status_code == 201
inactive_student = add_inactive_res.json()
print("Student added with status:", inactive_student["status"])

# Step 4: Inactive student tries to login
print("\n3. Student tries to login while status is 'Inactive':")
inactive_login_res = client.post("/api/auth/login", json={
    "email": target_email,
    "full_name": "Gowtham A",
    "device_id": "test_device_gowtham_123",
    "device_name": "Chrome on Windows 11"
})
print("Status (Expected 403):", inactive_login_res.status_code)
print("Response detail:", inactive_login_res.json().get("detail"))
assert inactive_login_res.status_code == 403, "Should reject inactive student!"

# Step 5: Admin updates student status to "Active"
print("\n4. Admin updates student status to 'Active':")
update_res = client.put(f"/api/students/{inactive_student['id']}", json={
    "status": "Active"
}, headers=master_headers)
assert update_res.status_code == 200
active_student = update_res.json()
print("Student updated status:", active_student["status"])

# Step 6: Student tries to login when Active
print("\n5. Student tries to login with Active status:")
active_login_res = client.post("/api/auth/login", json={
    "email": target_email,
    "full_name": "Gowtham A",
    "device_id": "test_device_gowtham_123",
    "device_name": "Chrome on Windows 11"
})
print("Status (Expected 200):", active_login_res.status_code)
login_data = active_login_res.json()
assert active_login_res.status_code == 200, "Should allow active student login!"
print("Access Token granted:", login_data["access_token"][:25] + "...")
user_profile = login_data["user"]
print("Student Profile returned:")
print(f"  • Name: {user_profile['full_name']}")
print(f"  • Email: {user_profile['email']}")
print(f"  • Register No: {user_profile.get('register_number')}")
print(f"  • Department: {user_profile.get('department')}")
print(f"  • Year: {user_profile.get('year')}")
print(f"  • Status: {user_profile.get('student_status')}")

# Step 7: Verify /api/auth/me returns the same student profile
student_token = login_data["access_token"]
me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {student_token}"})
assert me_res.status_code == 200
me_data = me_res.json()
print("\n6. GET /api/auth/me verification:")
print(f"  • Name: {me_data['full_name']}")
print(f"  • Register No: {me_data.get('register_number')}")
print(f"  • Department: {me_data.get('department')}")
print(f"  • Year: {me_data.get('year')}")

db.close()
print("\n=======================================================")
print("STUDENT LOGIN VERIFICATION FLOW COMPLETED WITH 100% SUCCESS!")
print(f"Student '{target_email}' is ENROLLED and ACTIVE in Database!")
print("=======================================================")
