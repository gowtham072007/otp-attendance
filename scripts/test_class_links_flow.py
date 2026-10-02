import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Student, AdminClassLink, AttendanceRecord, AttendanceSession
from app.auth.utils import create_access_token, hash_password

client = TestClient(app)
db = SessionLocal()

print("=" * 80)
print("TEST SUITE: MASTER ADMIN -> LINK ADMINS / SHARED CLASS ROSTER")
print("=" * 80)

# Setup Test Users
# 1. Master Admin
initial_admin_email = os.getenv("INITIAL_ADMIN_EMAIL", "admin@francisxavier.ac.in").strip().lower()
master_admin = db.query(User).filter(User.role == "ADMIN", User.email == initial_admin_email).first()
if not master_admin:
    master_admin = db.query(User).filter(User.role == "ADMIN").first()

assert master_admin, "Master admin account must exist"
master_token = create_access_token(data={"sub": master_admin.email})
master_headers = {"Authorization": f"Bearer {master_token}"}
print(f"[SETUP] Master Admin: {master_admin.full_name} ({master_admin.email})")

# 2. Gowtham Admin (Class Teacher 1)
gowtham_email = "gowtham_test_teacher@francisxavier.ac.in"
gowtham = db.query(User).filter(User.email == gowtham_email).first()
if not gowtham:
    gowtham = User(
        email=gowtham_email,
        full_name="Gowtham",
        hashed_password=hash_password("teacher123"),
        role="ADMIN",
        is_approved=True
    )
    db.add(gowtham)
    db.commit()
    db.refresh(gowtham)
gowtham_token = create_access_token(data={"sub": gowtham.email})
gowtham_headers = {"Authorization": f"Bearer {gowtham_token}"}
print(f"[SETUP] Gowtham Admin: ID {gowtham.id} ({gowtham.email})")

# 3. Jaison Admin (Class Teacher 2)
jaison_email = "jaison_test_teacher@francisxavier.ac.in"
jaison = db.query(User).filter(User.email == jaison_email).first()
if not jaison:
    jaison = User(
        email=jaison_email,
        full_name="Jaison",
        hashed_password=hash_password("teacher123"),
        role="ADMIN",
        is_approved=True
    )
    db.add(jaison)
    db.commit()
    db.refresh(jaison)
jaison_token = create_access_token(data={"sub": jaison.email})
jaison_headers = {"Authorization": f"Bearer {jaison_token}"}
print(f"[SETUP] Jaison Admin: ID {jaison.id} ({jaison.email})")

# Clean up previous test class links and test students
dept_aids = "Artificial Intelligence & Data Science"
year_2nd = "2nd Year"
section_a = "A"

dept_cse = "Computer Science & Engineering"
year_1st = "1st Year"
section_b = "B"

test_emails = [
    "student_a_test@francisxavier.ac.in",
    "student_b_test@francisxavier.ac.in",
    "student_c_test@francisxavier.ac.in"
]

db.query(AdminClassLink).filter(
    AdminClassLink.admin_id.in_([gowtham.id, jaison.id])
).delete(synchronize_session=False)

for email in test_emails:
    db.query(Student).filter(Student.email == email).delete(synchronize_session=False)
    db.query(User).filter(User.email == email).delete(synchronize_session=False)

db.commit()
print("[SETUP] Cleaned up previous test class links and test students.")

# ==============================================================================
# TEST 1 — MASTER ADMIN LINKS GOWTHAM + JAISON TO 2nd Year AI & DS - A
# ==============================================================================
print("\n" + "="*50)
print("[TEST 1] Master Admin links Gowtham + Jaison to 2nd Year AI & DS - Section A")
print("="*50)

link_res = client.post("/api/admin/class-links", json={
    "department": dept_aids,
    "year": year_2nd,
    "section": section_a,
    "admin_ids": [gowtham.id, jaison.id]
}, headers=master_headers)

print(f"Status Code: {link_res.status_code}")
assert link_res.status_code == 201, f"Failed to link admins: {link_res.text}"
link_data = link_res.json()
print("Link Response:", link_data)
assert link_data["section"] == "A"
assert link_data["year"] == year_2nd
assert len(link_data["linked_admins"]) == 2
linked_admin_ids = [a["id"] for a in link_data["linked_admins"]]
assert gowtham.id in linked_admin_ids
assert jaison.id in linked_admin_ids
print("[PASS] TEST 1: Master Admin successfully linked Gowtham and Jaison to 2nd Year AI & DS - A.")

# Verify class-links list
list_links_res = client.get("/api/admin/class-links", headers=master_headers)
assert list_links_res.status_code == 200
groups = list_links_res.json()
found_group = next((g for g in groups if g["department"] == dept_aids and g["year"] == year_2nd and g["section"] == section_a), None)
assert found_group is not None, "Class link group should be found in GET /api/admin/class-links"
print(f"[OK] Class Links endpoint correctly lists group with {len(found_group['linked_admins'])} admins.")

# Verify Gowtham and Jaison see this class in my-classes
gowtham_classes_res = client.get("/api/admin/my-classes", headers=gowtham_headers)
assert gowtham_classes_res.status_code == 200
assert any(c["department"] == dept_aids and c["section"] == "A" for c in gowtham_classes_res.json())

jaison_classes_res = client.get("/api/admin/my-classes", headers=jaison_headers)
assert jaison_classes_res.status_code == 200
assert any(c["department"] == dept_aids and c["section"] == "A" for c in jaison_classes_res.json())
print("[OK] Both Gowtham and Jaison have this class in their authorized classes.")

# ==============================================================================
# TEST 2 — GOWTHAM ADDS STUDENT A TO 2nd Year AI & DS - A
# ==============================================================================
print("\n" + "="*50)
print("[TEST 2] Gowtham adds Student A to 2nd Year AI & DS - A")
print("="*50)

student_a_payload = {
    "name": "Student A Gowthama",
    "register_number": "95072517036",
    "email": "student_a_test@francisxavier.ac.in",
    "phone": "9876543210",
    "department": dept_aids,
    "year": year_2nd,
    "section": "A",
    "status": "Active"
}

add_a_res = client.post("/api/students", json=student_a_payload, headers=gowtham_headers)
print(f"Status Code: {add_a_res.status_code}")
assert add_a_res.status_code == 201, f"Gowtham failed to add Student A: {add_a_res.text}"
student_a_data = add_a_res.json()
student_a_id = student_a_data["id"]
print(f"[OK] Student A created with database ID: {student_a_id}, section: {student_a_data.get('section')}")

# Gowtham sees Student A
gowtham_students_res = client.get("/api/students", headers=gowtham_headers)
assert gowtham_students_res.status_code == 200
gowtham_students = gowtham_students_res.json()
assert any(s["id"] == student_a_id for s in gowtham_students), "Gowtham MUST see Student A"
print("[PASS] Gowtham sees Student A in his roster.")

# Jaison also sees Student A
jaison_students_res = client.get("/api/students", headers=jaison_headers)
assert jaison_students_res.status_code == 200
jaison_students = jaison_students_res.json()
assert any(s["id"] == student_a_id for s in jaison_students), "Jaison MUST also see Student A"
print("[PASS] Jaison also sees Student A in his roster!")

# Check DB: Exactly ONE record
count_a = db.query(Student).filter(Student.register_number == "95072517036").count()
assert count_a == 1, f"There must be only ONE student record in database! Found: {count_a}"
print("[PASS] Verified NO DUPLICATION: Exactly 1 database record exists for Student A.")

# ==============================================================================
# TEST 3 — JAISON ADDS STUDENT B TO THE SAME CLASS
# ==============================================================================
print("\n" + "="*50)
print("[TEST 3] Jaison adds Student B to 2nd Year AI & DS - A")
print("="*50)

student_b_payload = {
    "name": "Student B Jaison",
    "register_number": "95072517037",
    "email": "student_b_test@francisxavier.ac.in",
    "phone": "9876543211",
    "department": dept_aids,
    "year": year_2nd,
    "section": "A",
    "status": "Active"
}

add_b_res = client.post("/api/students", json=student_b_payload, headers=jaison_headers)
print(f"Status Code: {add_b_res.status_code}")
assert add_b_res.status_code == 201, f"Jaison failed to add Student B: {add_b_res.text}"
student_b_data = add_b_res.json()
student_b_id = student_b_data["id"]
print(f"[OK] Student B created with database ID: {student_b_id}, section: {student_b_data.get('section')}")

# Jaison sees Student B
jaison_students_res2 = client.get("/api/students", headers=jaison_headers)
jaison_students2 = jaison_students_res2.json()
assert any(s["id"] == student_b_id for s in jaison_students2), "Jaison MUST see Student B"
assert any(s["id"] == student_a_id for s in jaison_students2), "Jaison MUST see Student A"
print("[PASS] Jaison sees both Student A and Student B.")

# Gowtham sees Student B
gowtham_students_res2 = client.get("/api/students", headers=gowtham_headers)
gowtham_students2 = gowtham_students_res2.json()
assert any(s["id"] == student_b_id for s in gowtham_students2), "Gowtham MUST see Student B added by Jaison"
assert any(s["id"] == student_a_id for s in gowtham_students2), "Gowtham MUST see Student A added by Gowtham"
print("[PASS] Gowtham sees both Student A and Student B!")

# Check DB: Exactly ONE record for Student B
count_b = db.query(Student).filter(Student.register_number == "95072517037").count()
assert count_b == 1, f"There must be only ONE student record for Student B in database! Found: {count_b}"
print("[PASS] Verified NO DUPLICATION: Exactly 1 database record exists for Student B.")

# ==============================================================================
# TEST 4 — MASTER ADMIN VIEWS STUDENTS
# ==============================================================================
print("\n" + "="*50)
print("[TEST 4] Master Admin views Students")
print("="*50)

master_students_res = client.get("/api/master-admin/students", headers=master_headers)
assert master_students_res.status_code == 200
master_students = master_students_res.json()["students"]

assert any(s["id"] == student_a_id for s in master_students), "Master Admin MUST see Student A"
assert any(s["id"] == student_b_id for s in master_students), "Master Admin MUST see Student B"
print(f"[PASS] Master Admin sees both Student A and Student B across classes.")

# Test section filtering in Master Admin
master_sec_res = client.get("/api/master-admin/students?section=A", headers=master_headers)
assert master_sec_res.status_code == 200
assert all(s.get("section") == "A" for s in master_sec_res.json()["students"])
print("[PASS] Master Admin can filter students by section A.")

# ==============================================================================
# TEST 5 — MASTER ADMIN REMOVES JAISON FROM THE CLASS
# ==============================================================================
print("\n" + "="*50)
print("[TEST 5] Master Admin removes Jaison from 2nd Year AI & DS - A")
print("="*50)

del_link_res = client.delete(
    "/api/admin/class-links",
    params={
        "department": dept_aids,
        "year": year_2nd,
        "section": section_a,
        "admin_id": jaison.id
    },
    headers=master_headers
)
print(f"Status Code: {del_link_res.status_code}")
assert del_link_res.status_code == 200, f"Failed to unlink Jaison: {del_link_res.text}"
print("Delete Response:", del_link_res.json())

# Gowtham STILL sees Student A and Student B
gowtham_check_res = client.get("/api/students", headers=gowtham_headers)
gowtham_students_after = gowtham_check_res.json()
assert any(s["id"] == student_a_id for s in gowtham_students_after), "Gowtham MUST still see Student A"
assert any(s["id"] == student_b_id for s in gowtham_students_after), "Gowtham MUST still see Student B"
print("[PASS] Gowtham still sees both Student A and Student B.")

# Jaison NO LONGER sees students from this class
jaison_check_res = client.get("/api/students", headers=jaison_headers)
jaison_students_after = jaison_check_res.json()
assert not any(s["id"] == student_a_id for s in jaison_students_after), "Jaison MUST NOT see Student A anymore"
assert not any(s["id"] == student_b_id for s in jaison_students_after), "Jaison MUST NOT see Student B anymore"
print("[PASS] Jaison no longer sees students from 2nd Year AI & DS - A.")

# Crucial check: Students A and B are NOT deleted from database!
still_student_a = db.query(Student).filter(Student.id == student_a_id).first()
still_student_b = db.query(Student).filter(Student.id == student_b_id).first()
assert still_student_a is not None, "Student A must NOT be deleted from database!"
assert still_student_b is not None, "Student B must NOT be deleted from database!"
print("[PASS] CRITICAL REQUIREMENT VERIFIED: Removing Admin did NOT delete students from database!")

# ==============================================================================
# TEST 6 — MASTER ADMIN LINKS JAISON TO ANOTHER CLASS
# ==============================================================================
print("\n" + "="*50)
print("[TEST 6] Master Admin links Jaison to another class: 1st Year CSE - B")
print("="*50)

# Link Jaison to 1st Year CSE - B
link_cse_res = client.post("/api/admin/class-links", json={
    "department": dept_cse,
    "year": year_1st,
    "section": section_b,
    "admin_ids": [jaison.id]
}, headers=master_headers)
assert link_cse_res.status_code == 201
print(f"[OK] Jaison linked to {dept_cse} - {year_1st} (Sec {section_b})")

# Jaison adds Student C to his new class
student_c_payload = {
    "name": "Student C CSE",
    "register_number": "95072517099",
    "email": "student_c_test@francisxavier.ac.in",
    "phone": "9876543299",
    "department": dept_cse,
    "year": year_1st,
    "section": section_b,
    "status": "Active"
}
add_c_res = client.post("/api/students", json=student_c_payload, headers=jaison_headers)
assert add_c_res.status_code == 201
student_c_id = add_c_res.json()["id"]
print(f"[OK] Student C added by Jaison with ID: {student_c_id}")

# Jaison sees Student C, but NOT Student A or B
jaison_new_res = client.get("/api/students", headers=jaison_headers)
jaison_new_list = jaison_new_res.json()
assert any(s["id"] == student_c_id for s in jaison_new_list), "Jaison MUST see Student C"
assert not any(s["id"] == student_a_id for s in jaison_new_list), "Jaison MUST NOT see Student A"
assert not any(s["id"] == student_b_id for s in jaison_new_list), "Jaison MUST NOT see Student B"
print("[PASS] Jaison sees Student C in his new class, and cannot see students from unlinked class.")

# Gowtham sees Student A and B, but NOT Student C
gowtham_new_res = client.get("/api/students", headers=gowtham_headers)
gowtham_new_list = gowtham_new_res.json()
assert any(s["id"] == student_a_id for s in gowtham_new_list), "Gowtham MUST see Student A"
assert any(s["id"] == student_b_id for s in gowtham_new_list), "Gowtham MUST see Student B"
assert not any(s["id"] == student_c_id for s in gowtham_new_list), "Gowtham MUST NOT see Student C"
print("[PASS] Gowtham sees his own class roster and cannot see Jaison's new class.")

# ==============================================================================
# TEST 7 — STUDENT LOGIN & ATTENDANCE
# ==============================================================================
print("\n" + "="*50)
print("[TEST 7] Student Login via Registered Email")
print("="*50)

# Student login request
login_req_res = client.post("/api/auth/login", json={
    "email": "student_a_test@francisxavier.ac.in",
    "device_id": "test_device_student_a_001",
    "device_name": "Chrome on Windows"
})
assert login_req_res.status_code == 200, f"Student login failed: {login_req_res.text}"
login_req_data = login_req_res.json()
print("Student Login Request Response:", login_req_data)

# Retrieve student user created or fetched
student_user = db.query(User).filter(User.email == "student_a_test@francisxavier.ac.in").first()
assert student_user is not None, "Student user account must exist"
assert student_user.role in ["USER", "STUDENT"]
print(f"[OK] Student User account in DB: ID {student_user.id}, Role: {student_user.role}")

# Generate student auth token and verify student access
student_token = create_access_token(data={"sub": student_user.email})
student_headers = {"Authorization": f"Bearer {student_token}"}

me_res = client.get("/api/auth/me", headers=student_headers)
assert me_res.status_code == 200
me_data = me_res.json()
assert me_data["email"] == "student_a_test@francisxavier.ac.in"
assert me_data["role"].lower() in ["student", "user"]
assert me_data["section"] == "A"
print(f"[PASS] Student successfully accesses their dashboard profile: {me_data['full_name']} (Section {me_data['section']})")

# ==============================================================================
# TEST 8 — SECURITY ENFORCEMENT ON BACKEND
# ==============================================================================
print("\n" + "="*50)
print("[TEST 8] Backend Authorization & Security Checks")
print("="*50)

# Regular admin cannot create class links (Forbidden 403)
bad_link_res = client.post("/api/admin/class-links", json={
    "department": dept_aids,
    "year": year_2nd,
    "section": "C",
    "admin_ids": [gowtham.id]
}, headers=gowtham_headers)
assert bad_link_res.status_code == 403, f"Expected 403 Forbidden, got {bad_link_res.status_code}"
print("[PASS] Regular admin CANNOT create class links (HTTP 403 Forbidden).")

# Regular admin cannot add student to unauthorized class (Forbidden 403)
unauthorized_student_res = client.post("/api/students", json={
    "name": "Hacker Student",
    "register_number": "95079999999",
    "email": "hacker@francisxavier.ac.in",
    "department": "Mechanical Engineering",
    "year": "4th Year",
    "section": "A",
    "status": "Active"
}, headers=gowtham_headers)
assert unauthorized_student_res.status_code == 403, f"Expected 403 Forbidden, got {unauthorized_student_res.status_code}"
print("[PASS] Regular admin CANNOT add student to unauthorized class (HTTP 403 Forbidden).")

# Student cannot access admin endpoints
student_forbidden_res = client.get("/api/students", headers=student_headers)
assert student_forbidden_res.status_code == 403, f"Expected 403 Forbidden, got {student_forbidden_res.status_code}"
print("[PASS] Student CANNOT access admin student roster (HTTP 403 Forbidden).")

# Clean up test artifacts
db.query(AdminClassLink).filter(
    AdminClassLink.admin_id.in_([gowtham.id, jaison.id])
).delete(synchronize_session=False)

for email in test_emails:
    db.query(Student).filter(Student.email == email).delete(synchronize_session=False)
    db.query(User).filter(User.email == email).delete(synchronize_session=False)

db.commit()

print("\n" + "="*80)
print("ALL TESTS 1 - 7 (AND SECURITY ENFORCEMENT) PASSED SUCCESSFULLY!")
print("="*80)
