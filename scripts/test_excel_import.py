import io
import os
import sys

# Ensure backend directory is in python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import openpyxl
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Student

client = TestClient(app)

def test_excel_templates_and_bulk():
    db = SessionLocal()
    try:
        # Find an admin or master admin user to authenticate with
        admin = db.query(User).filter(
            (User.role.in_(['ADMIN', 'admin', 'master_admin'])) |
            (User.email == 'admin@francisxavier.ac.in')
        ).first()
        if not admin:
            print("No admin user found to test with.")
            return

        from app.routes.auth import create_access_token
        token = create_access_token(data={"sub": admin.email, "role": admin.role})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test Excel Template Download
        print("Testing GET /api/students/template/excel...")
        res = client.get("/api/students/template/excel", headers=headers)
        assert res.status_code == 200, f"Status code: {res.status_code}"
        assert res.headers.get("content-type") == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        # Validate that the downloaded content is indeed a readable excel workbook
        wb = openpyxl.load_workbook(io.BytesIO(res.content))
        sheet = wb.active
        headers_row = [cell.value for cell in sheet[1]]
        print("Downloaded Excel template headers:", headers_row)
        assert "Student Name" in headers_row
        assert "Student ID / Register No" in headers_row
        assert "Email" in headers_row

        # 2. Test CSV Template Download
        print("Testing GET /api/students/template/csv...")
        res = client.get("/api/students/template/csv", headers=headers)
        assert res.status_code == 200
        assert "text/csv" in res.headers.get("content-type", "")
        csv_text = res.text.lstrip("\ufeff")
        print("CSV Template snippet:\n", csv_text.strip().split("\n")[0])
        assert "Student Name" in csv_text

        # 3. Test Bulk JSON Import (/api/students/bulk)
        print("Testing POST /api/students/bulk...")
        import uuid
        rnd = uuid.uuid4().hex[:6]
        bulk_payload = {
            "students": [
                {
                    "name": f"Test Student {rnd} 1",
                    "register_number": f"REG_{rnd}_1",
                    "email": f"teststudent_{rnd}_1@francisxavier.ac.in",
                    "phone": "9876543210",
                    "department": "Computer Science & Engineering (CSE)",
                    "year": "1st Year (I)",
                    "status": "Active"
                },
                {
                    "name": f"Test Student {rnd} 2",
                    "register_number": f"REG_{rnd}_2",
                    "email": f"teststudent_{rnd}_2@francisxavier.ac.in",
                    "phone": "9876543211",
                    "department": "Artificial Intelligence & Data Science (AIDS)",
                    "year": "2nd Year (II)",
                    "status": "Active"
                },
                # Duplicate within same batch test
                {
                    "name": f"Test Student {rnd} Dup",
                    "register_number": f"REG_{rnd}_1",
                    "email": f"teststudent_{rnd}_dup@francisxavier.ac.in",
                    "phone": "9876543212",
                    "department": "Mechanical Engineering (MECH)",
                    "year": "3rd Year (III)",
                    "status": "Active"
                }
            ]
        }
        res = client.post("/api/students/bulk", json=bulk_payload, headers=headers)
        assert res.status_code == 200, f"Bulk import failed: {res.text}"
        data = res.json()
        print(f"Bulk response: added={data['added_count']}, skipped={data['skipped_count']}, errors={data['errors']}")
        assert data["added_count"] == 2
        assert data["skipped_count"] == 1
        assert any("already registered" in err.lower() or "duplicate" in err.lower() for err in data["errors"])

        # 4. Test Binary File Upload (/api/students/upload-excel)
        print("Testing POST /api/students/upload-excel...")
        wb_upload = openpyxl.Workbook()
        ws_upload = wb_upload.active
        ws_upload.title = "Students"
        ws_upload.append(["Full Name", "Roll No", "Email Address", "Mobile", "Dept", "Year", "Status"])
        ws_upload.append([f"Excel Student {rnd}", f"EXCEL_{rnd}", f"excel_{rnd}@francisxavier.ac.in", "9988776655", "CSE", "4th Year (IV)", "Active"])
        
        file_stream = io.BytesIO()
        wb_upload.save(file_stream)
        file_stream.seek(0)

        files = {
            "file": ("students_test.xlsx", file_stream, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        }
        res = client.post("/api/students/upload-excel", files=files, headers=headers)
        assert res.status_code == 200, f"Upload excel failed: {res.text}"
        upload_data = res.json()
        print(f"Upload response: added={upload_data['added_count']}, skipped={upload_data['skipped_count']}")
        assert upload_data["added_count"] == 1

        # Clean up test rows
        db.query(Student).filter(Student.register_number.in_([f"REG_{rnd}_1", f"REG_{rnd}_2", f"EXCEL_{rnd}"])).delete(synchronize_session=False)
        db.commit()
        print("All Excel & bulk import tests passed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    test_excel_templates_and_bulk()
