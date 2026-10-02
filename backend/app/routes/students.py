import os
import re
import io
import csv
import openpyxl
import openpyxl.styles
import openpyxl.utils
from typing import List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_

try:
    from ..database import get_db
    from ..models import User, Student, AdminClassLink
    from ..schemas import (
        StudentCreate, 
        StudentUpdate, 
        StudentResponse, 
        MasterAdminStudentStats,
        StudentBulkImportItem,
        StudentBulkImportRequest,
        StudentBulkImportResponse
    )
    from ..auth.utils import get_current_admin
except (ImportError, ValueError):
    from app.database import get_db
    from app.models import User, Student, AdminClassLink
    from app.schemas import (
        StudentCreate, 
        StudentUpdate, 
        StudentResponse, 
        MasterAdminStudentStats,
        StudentBulkImportItem,
        StudentBulkImportRequest,
        StudentBulkImportResponse
    )
    from app.auth.utils import get_current_admin

router = APIRouter(tags=["students"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@francisxavier.ac.in").strip().lower()

def is_master_admin(admin: User) -> bool:
    if not admin or not admin.email:
        return False
    return admin.email.strip().lower() == INITIAL_ADMIN_EMAIL

def normalize_class_key(department: Optional[str], year: Optional[str], section: Optional[str]) -> tuple[str, str, str]:
    return (
        (department or "").strip().lower(),
        (year or "").strip().lower(),
        (section or "A").strip().upper()
    )

def get_admin_authorized_classes(db: Session, admin_id: int) -> List[tuple[str, str, str]]:
    links = db.query(AdminClassLink).filter(AdminClassLink.admin_id == admin_id).all()
    return [normalize_class_key(l.department, l.year, l.section) for l in links]

def is_admin_authorized_for_class(db: Session, admin: User, department: Optional[str], year: Optional[str], section: Optional[str]) -> bool:
    if is_master_admin(admin):
        return True
    key = normalize_class_key(department, year, section)
    return key in get_admin_authorized_classes(db, admin.id)

def validate_email_format(email: str) -> str:
    cleaned = email.strip().lower()
    if not cleaned or "@" not in cleaned or "." not in cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid student email address is required (e.g. student@francisxavier.ac.in)."
        )
    return cleaned

def validate_register_number(reg_no: str) -> str:
    cleaned = reg_no.strip().upper()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student ID / Register Number is required."
        )
    return cleaned

def build_student_response(student: Student, db: Session) -> StudentResponse:
    creator = db.query(User).filter(User.id == student.admin_id).first()
    admin_name = creator.full_name if creator else "Administrator"
    admin_email = creator.email if creator else None
    
    return StudentResponse(
        id=student.id,
        name=student.name,
        register_number=student.register_number,
        email=student.email,
        phone=student.phone,
        department=student.department,
        year=student.year,
        section=student.section or "A",
        status=student.status or "Active",
        admin_id=student.admin_id,
        admin_name=admin_name,
        admin_email=admin_email,
        created_at=student.created_at,
        updated_at=student.updated_at
    )


# --- 1. Regular Admin Student Management Routes ---

@router.post("/students", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Add a new student to the central database, scoped to the authenticated Admin.
    The student email becomes the authenticated login identity.
    """
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Student name is required.")

    clean_reg_no = validate_register_number(payload.register_number)
    clean_email = validate_email_format(payload.email)

    # 1. Reject if email belongs to an Admin account
    admin_user = db.query(User).filter(func.lower(User.email) == clean_email, User.role == "ADMIN").first()
    if admin_user:
        raise HTTPException(
            status_code=400,
            detail="Cannot register an Administrator account as a student."
        )

    # 2. Check duplicate Register Number (Student ID) across all students
    existing_reg = db.query(Student).filter(func.upper(Student.register_number) == clean_reg_no).first()
    if existing_reg:
        raise HTTPException(
            status_code=400,
            detail=f"Student ID / Register Number '{clean_reg_no}' is already registered to '{existing_reg.name}'."
        )

    # 3. Check duplicate Email across all students
    existing_email = db.query(Student).filter(func.lower(Student.email) == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail=f"Student email '{clean_email}' is already registered with Student ID '{existing_email.register_number}'."
        )

    # 4. Create Student
    clean_phone = payload.phone.strip() if payload.phone else None
    clean_dept = payload.department.strip() if payload.department else None
    clean_year = payload.year.strip() if payload.year else None
    clean_section = (payload.section.strip().upper()) if payload.section else "A"
    clean_status = (payload.status.strip().capitalize()) if payload.status else "Active"

    if not is_master_admin(admin):
        if not is_admin_authorized_for_class(db, admin, clean_dept, clean_year, clean_section):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You are not authorized to add students to '{clean_dept or 'Unknown'} - {clean_year or 'Unknown'} (Sec {clean_section})'. Please contact Master Administrator to link this class to your account."
            )

    new_student = Student(
        name=clean_name,
        register_number=clean_reg_no,
        email=clean_email,
        phone=clean_phone,
        department=clean_dept,
        year=clean_year,
        section=clean_section,
        status=clean_status,
        admin_id=admin.id
    )
    db.add(new_student)

    # 5. Update user's full_name if user record already exists
    existing_user = db.query(User).filter(func.lower(User.email) == clean_email, User.role == "USER").first()
    if existing_user and not existing_user.full_name:
        existing_user.full_name = clean_name

    db.commit()
    db.refresh(new_student)

    return build_student_response(new_student, db)


@router.get("/students", response_model=List[StudentResponse])
def get_students(
    search: Optional[str] = None,
    department: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None,
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Get all students.
    - Regular Admin: Scoped to all students belonging to the Admin's linked classes.
    - Master Admin: Can view all students or filter by specific admin.
    """
    query = db.query(Student)

    # Scope by Admin role: Linked classes
    if not is_master_admin(admin):
        links = db.query(AdminClassLink).filter(AdminClassLink.admin_id == admin.id).all()
        if not links:
            return []
        conditions = []
        for l in links:
            conditions.append(
                and_(
                    func.lower(Student.department) == l.department.strip().lower(),
                    func.lower(Student.year) == l.year.strip().lower(),
                    func.upper(func.coalesce(Student.section, 'A')) == (l.section or "A").strip().upper()
                )
            )
        query = query.filter(or_(*conditions))
    elif admin_id:
        query = query.filter(Student.admin_id == admin_id)

    # Search filter
    if search and search.strip():
        q = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name.ilike(q),
                Student.register_number.ilike(q),
                Student.email.ilike(q),
                Student.phone.ilike(q),
                Student.department.ilike(q),
                Student.section.ilike(q)
            )
        )

    # Field filters
    if department and department.strip() and department.lower() != "all":
        query = query.filter(func.lower(Student.department) == department.strip().lower())

    if year and year.strip() and year.lower() != "all":
        query = query.filter(func.lower(Student.year) == year.strip().lower())

    if section and section.strip() and section.lower() != "all":
        query = query.filter(func.upper(func.coalesce(Student.section, 'A')) == section.strip().upper())

    if status and status.strip() and status.lower() != "all":
        query = query.filter(func.lower(Student.status) == status.strip().lower())

    students = query.order_by(Student.name.asc(), Student.id.asc()).all()

    # Pre-fetch admins for efficient response building
    admin_cache = {u.id: u for u in db.query(User).filter(User.role == "ADMIN").all()}

    results = []
    for s in students:
        creator = admin_cache.get(s.admin_id)
        results.append(StudentResponse(
            id=s.id,
            name=s.name,
            register_number=s.register_number,
            email=s.email,
            phone=s.phone,
            department=s.department,
            year=s.year,
            section=s.section or "A",
            status=s.status or "Active",
            admin_id=s.admin_id,
            admin_name=creator.full_name if creator else "Administrator",
            admin_email=creator.email if creator else None,
            created_at=s.created_at,
            updated_at=s.updated_at
        ))
    return results


@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student_by_id(
    student_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Fetch single student with authorization check."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not is_master_admin(admin) and not is_admin_authorized_for_class(db, admin, student.department, student.year, student.section):
        raise HTTPException(status_code=403, detail="Access Denied: You are not authorized to view this student.")

    return build_student_response(student, db)


@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Update student record with field validation and authorization check."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not is_master_admin(admin) and not is_admin_authorized_for_class(db, admin, student.department, student.year, student.section):
        raise HTTPException(status_code=403, detail="Access Denied: You are not authorized to edit this student.")

    # 1. Update name
    if payload.name is not None:
        clean_name = payload.name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Student name cannot be empty.")
        student.name = clean_name

    # 2. Update Register Number (check uniqueness)
    if payload.register_number is not None:
        clean_reg_no = validate_register_number(payload.register_number)
        existing_reg = db.query(Student).filter(
            func.upper(Student.register_number) == clean_reg_no,
            Student.id != student_id
        ).first()
        if existing_reg:
            raise HTTPException(
                status_code=400,
                detail=f"Student ID / Register Number '{clean_reg_no}' is already used by '{existing_reg.name}'."
            )
        student.register_number = clean_reg_no

    # 3. Update Email (check uniqueness & admin check)
    old_email = student.email
    if payload.email is not None:
        clean_email = validate_email_format(payload.email)
        admin_user = db.query(User).filter(func.lower(User.email) == clean_email, User.role == "ADMIN").first()
        if admin_user:
            raise HTTPException(status_code=400, detail="Cannot assign an Administrator email address to a student.")

        existing_email = db.query(Student).filter(
            func.lower(Student.email) == clean_email,
            Student.id != student_id
        ).first()
        if existing_email:
            raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already used by another student.")
        student.email = clean_email

    # 4. Optional fields
    if payload.phone is not None:
        student.phone = payload.phone.strip() if payload.phone else None

    # Check if target class is being changed
    target_dept = payload.department.strip() if payload.department is not None else student.department
    target_year = payload.year.strip() if payload.year is not None else student.year
    target_sec = payload.section.strip().upper() if payload.section is not None else (student.section or "A")

    if not is_master_admin(admin) and not is_admin_authorized_for_class(db, admin, target_dept, target_year, target_sec):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access Denied: You are not authorized to assign students to class '{target_dept} - {target_year} (Sec {target_sec})'."
        )

    if payload.department is not None:
        student.department = target_dept

    if payload.year is not None:
        student.year = target_year

    if payload.section is not None:
        student.section = target_sec

    if payload.status is not None:
        student.status = payload.status.strip().capitalize() if payload.status else "Active"

    student.updated_at = datetime.now(timezone.utc)

    # Sync name with User model if exists
    if student.name:
        user_record = db.query(User).filter(func.lower(User.email) == student.email.lower()).first()
        if user_record:
            user_record.full_name = student.name

    db.commit()
    db.refresh(student)

    return build_student_response(student, db)


@router.delete("/students/all")
def delete_all_students(
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Delete all student records.
    - Regular Admin: Deletes all students belonging to the Admin's linked classes.
    - Master Admin: Deletes all student records globally across the institution (or for a specific admin if admin_id is provided).
    """
    if not is_master_admin(admin):
        links = db.query(AdminClassLink).filter(AdminClassLink.admin_id == admin.id).all()
        if not links:
            return {
                "message": "No classes linked to your account. No students deleted.",
                "deleted_count": 0
            }
        conditions = []
        for l in links:
            conditions.append(
                and_(
                    func.lower(Student.department) == l.department.strip().lower(),
                    func.lower(Student.year) == l.year.strip().lower(),
                    func.upper(func.coalesce(Student.section, 'A')) == (l.section or "A").strip().upper()
                )
            )
        query = db.query(Student).filter(or_(*conditions))
    else:
        query = db.query(Student)
        if admin_id:
            query = query.filter(Student.admin_id == admin_id)

    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return {
        "message": f"Successfully removed {deleted_count} student record(s).",
        "deleted_count": deleted_count
    }


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Delete a student record with class-link authorization check."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not is_master_admin(admin) and not is_admin_authorized_for_class(db, admin, student.department, student.year, student.section):
        raise HTTPException(status_code=403, detail="Access Denied: You are not authorized to delete this student.")

    student_name = student.name
    student_reg = student.register_number
    student_email = student.email.lower().strip()
    admin_id = student.admin_id



    db.delete(student)
    db.commit()

    return {
        "message": f"Student '{student_name}' ({student_reg}) has been successfully deleted.",
        "deleted_id": student_id
    }


def map_row_dict_to_student(row_dict: dict) -> dict:
    def get_val(matcher) -> Optional[str]:
        for k, v in row_dict.items():
            if v is None:
                continue
            v_str = str(v).strip()
            if not v_str:
                continue
            k_clean = "".join(c for c in str(k).lower() if c.isalnum())
            if matcher(k_clean):
                return v_str
        return None

    name = get_val(lambda k: any(x in k for x in ["studentname", "fullname", "name"]) and not any(x in k for x in ["dept", "admin", "class", "year"]))
    register_number = get_val(lambda k: any(x in k for x in ["regno", "regnumber", "registerno", "registernumber", "reg", "rollno", "rollnumber", "roll", "studentid", "studentreg"]))
    if not register_number:
        register_number = get_val(lambda k: k == "id" or k.endswith("id"))
    email = get_val(lambda k: "email" in k or "mail" in k)
    phone = get_val(lambda k: any(x in k for x in ["phone", "mobile", "contact", "cell"]))
    department = get_val(lambda k: any(x in k for x in ["dept", "department", "branch", "degree"]))
    year = get_val(lambda k: any(x in k for x in ["year", "class", "batch", "sem", "semester"]))
    section_val = get_val(lambda k: any(x in k for x in ["section", "sec", "secname", "division"])) or "A"
    status_val = get_val(lambda k: "status" in k)

    return {
        "name": name,
        "register_number": register_number,
        "email": email,
        "phone": phone,
        "department": department,
        "year": year,
        "section": section_val.strip().upper(),
        "status": status_val or "Active"
    }


def parse_excel_or_csv_file(file_bytes: bytes, filename: str) -> List[dict]:
    filename_lower = filename.lower()
    records = []

    if filename_lower.endswith(".csv"):
        text = None
        for enc in ("utf-8-sig", "utf-8", "latin1"):
            try:
                text = file_bytes.decode(enc)
                break
            except Exception:
                continue
        if text is None:
            text = file_bytes.decode("utf-8", errors="ignore")
        
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return []
        header = [c.strip().lower() for c in rows[0]]
        for row in rows[1:]:
            if not any(c.strip() for c in row):
                continue
            row_dict = {}
            for idx, col_name in enumerate(header):
                if idx < len(row):
                    row_dict[col_name] = row[idx].strip()
            records.append(map_row_dict_to_student(row_dict))
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        if sheet is None:
            return []
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        header = [str(c).strip().lower() if c is not None else "" for c in rows[0]]
        for row in rows[1:]:
            if not any(c is not None and str(c).strip() for c in row):
                continue
            row_dict = {}
            for idx, col_name in enumerate(header):
                if idx < len(row) and col_name:
                    val = row[idx]
                    row_dict[col_name] = str(val).strip() if val is not None else ""
            records.append(map_row_dict_to_student(row_dict))

    return records


def process_bulk_students(
    student_items: List[dict],
    admin: User,
    db: Session
) -> StudentBulkImportResponse:
    added_students = []
    errors = []
    skipped_count = 0
    added_count = 0

    admin_emails = {
        u[0].strip().lower() 
        for u in db.query(User.email).filter(User.role == "ADMIN", User.email.isnot(None)).all()
    }
    if INITIAL_ADMIN_EMAIL:
        admin_emails.add(INITIAL_ADMIN_EMAIL)

    existing_reg_nos = {
        r[0].strip().upper() 
        for r in db.query(Student.register_number).filter(Student.register_number.isnot(None)).all()
    }
    existing_emails = {
        e[0].strip().lower() 
        for e in db.query(Student.email).filter(Student.email.isnot(None)).all()
    }

    batch_reg_nos = set()
    batch_emails = set()

    to_add = []
    now_utc = datetime.now(timezone.utc)

    for idx, item in enumerate(student_items, start=1):
        raw_name = str(item.get("name") or "").strip()
        raw_reg = str(item.get("register_number") or "").strip().upper()
        raw_email = str(item.get("email") or "").strip().lower()
        raw_phone = str(item.get("phone") or "").strip() or None
        raw_dept = str(item.get("department") or "").strip() or None
        raw_year = str(item.get("year") or "").strip() or None
        raw_sec = str(item.get("section") or "A").strip().upper()
        if not raw_sec:
            raw_sec = "A"
        raw_status = str(item.get("status") or "Active").strip().capitalize()
        if raw_status not in ("Active", "Inactive"):
            raw_status = "Active"

        row_desc = f"Row {idx} ({raw_name or 'Unknown'} / {raw_reg or 'No ID'})"

        if not raw_name:
            errors.append(f"{row_desc}: Student Name is missing.")
            skipped_count += 1
            continue

        if not raw_reg:
            errors.append(f"{row_desc}: Student ID / Register Number is missing.")
            skipped_count += 1
            continue

        if not raw_email or "@" not in raw_email or "." not in raw_email:
            errors.append(f"{row_desc}: Invalid email address '{raw_email}'.")
            skipped_count += 1
            continue

        if raw_email in admin_emails:
            errors.append(f"{row_desc}: Email '{raw_email}' belongs to an Administrator account.")
            skipped_count += 1
            continue

        if not is_master_admin(admin) and not is_admin_authorized_for_class(db, admin, raw_dept, raw_year, raw_sec):
            errors.append(f"{row_desc}: Class '{raw_dept or 'Unknown'} - {raw_year or 'Unknown'} (Sec {raw_sec})' is not linked to your admin account.")
            skipped_count += 1
            continue

        if raw_reg in existing_reg_nos:
            errors.append(f"{row_desc}: Student ID '{raw_reg}' already registered in database.")
            skipped_count += 1
            continue

        if raw_email in existing_emails:
            errors.append(f"{row_desc}: Email '{raw_email}' already registered in database.")
            skipped_count += 1
            continue

        if raw_reg in batch_reg_nos:
            errors.append(f"{row_desc}: Duplicate Student ID '{raw_reg}' inside this file.")
            skipped_count += 1
            continue

        if raw_email in batch_emails:
            errors.append(f"{row_desc}: Duplicate email '{raw_email}' inside this file.")
            skipped_count += 1
            continue

        batch_reg_nos.add(raw_reg)
        batch_emails.add(raw_email)

        new_student = Student(
            name=raw_name,
            register_number=raw_reg,
            email=raw_email,
            phone=raw_phone,
            department=raw_dept,
            year=raw_year,
            section=raw_sec,
            status=raw_status,
            admin_id=admin.id,
            created_at=now_utc,
            updated_at=now_utc
        )
        to_add.append(new_student)
        existing_reg_nos.add(raw_reg)
        existing_emails.add(raw_email)

    if to_add:
        db.add_all(to_add)
        db.commit()
        for s in to_add:
            db.refresh(s)
            added_students.append(build_student_response(s, db))
        added_count = len(to_add)

    return StudentBulkImportResponse(
        total_received=len(student_items),
        added_count=added_count,
        skipped_count=skipped_count,
        added_students=added_students,
        errors=errors
    )


@router.post("/students/bulk", response_model=StudentBulkImportResponse)
def bulk_import_students(
    payload: StudentBulkImportRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Bulk import students from a list of records.
    Validates each student, ignores/reports errors, and persists valid records.
    """
    items = [item.model_dump() for item in payload.students]
    return process_bulk_students(items, admin, db)


@router.post("/students/upload-excel", response_model=StudentBulkImportResponse)
async def upload_excel_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Upload an Excel (.xlsx, .xls) or CSV spreadsheet file containing student records.
    Automatically parses columns, validates entries, and inserts new students.
    """
    filename = file.filename or "students.xlsx"
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        items = parse_excel_or_csv_file(contents, filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse spreadsheet file: {str(e)}")

    if not items:
        raise HTTPException(status_code=400, detail="No data rows found in the uploaded file.")

    return process_bulk_students(items, admin, db)


@router.get("/students/template/excel")
def download_excel_template():
    """
    Download a formatted Excel (.xlsx) template for bulk student upload.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Students Template"

    headers = [
        "Student Name", 
        "Student ID / Register No", 
        "Email", 
        "Phone Number", 
        "Department", 
        "Year / Class", 
        "Section",
        "Status"
    ]
    ws.append(headers)

    ws.append([
        "Sample Student One",
        "95072517001",
        "sample.student1@francisxavier.ac.in",
        "9876543210",
        "Artificial Intelligence & Data Science (AIDS)",
        "2nd Year (II)",
        "A",
        "Active"
    ])
    ws.append([
        "Sample Student Two",
        "95072517002",
        "sample.student2@francisxavier.ac.in",
        "9876543211",
        "Computer Science & Engineering (CSE)",
        "1st Year (I)",
        "B",
        "Active"
    ])

    header_fill = openpyxl.styles.PatternFill(start_color="059669", end_color="059669", fill_type="solid")
    header_font = openpyxl.styles.Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = openpyxl.styles.Alignment(horizontal="center", vertical="center")

    col_widths = [32, 26, 36, 18, 42, 18, 12, 14]
    for col_idx, width in enumerate(col_widths, 1):
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    resp_headers = {
        "Content-Disposition": "attachment; filename=students_import_template.xlsx"
    }
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=resp_headers
    )


@router.get("/students/template/csv")
def download_csv_template():
    """
    Download a sample CSV template for bulk student upload.
    """
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "Student Name", 
        "Student ID / Register No", 
        "Email", 
        "Phone Number", 
        "Department", 
        "Year / Class", 
        "Section",
        "Status"
    ])
    writer.writerow([
        "Sample Student One",
        "95072517001",
        "sample.student1@francisxavier.ac.in",
        "9876543210",
        "Artificial Intelligence & Data Science (AIDS)",
        "2nd Year (II)",
        "A",
        "Active"
    ])
    writer.writerow([
        "Sample Student Two",
        "95072517002",
        "sample.student2@francisxavier.ac.in",
        "9876543211",
        "Computer Science & Engineering (CSE)",
        "1st Year (I)",
        "B",
        "Active"
    ])
    
    content = output.getvalue()
    resp_headers = {
        "Content-Disposition": "attachment; filename=students_import_template.csv"
    }
    return Response(content=content, media_type="text/csv", headers=resp_headers)


# --- 2. Master Admin Global Student List Routes ---

@router.get("/master-admin/students")
def get_master_admin_students(
    search: Optional[str] = None,
    department: Optional[str] = None,
    year: Optional[str] = None,
    section: Optional[str] = None,
    status: Optional[str] = None,
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Master Admin endpoint to view and manage all students enrolled by all Admins.
    Returns student list, summary metrics, and distinct department/year/section filters.
    """
    if not is_master_admin(admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only the Master Administrator can view institute-wide student lists."
        )

    # 1. Compute overall metrics
    total_count = db.query(Student).count()
    active_count = db.query(Student).filter(func.lower(Student.status) == "active").count()
    inactive_count = total_count - active_count
    
    # Distinct departments, years, and sections for filter dropdowns
    dept_rows = db.query(Student.department).filter(Student.department.isnot(None), Student.department != "").distinct().all()
    departments = sorted([d[0] for d in dept_rows if d[0]])
    
    year_rows = db.query(Student.year).filter(Student.year.isnot(None), Student.year != "").distinct().all()
    years = sorted([y[0] for y in year_rows if y[0]])

    section_rows = db.query(Student.section).filter(Student.section.isnot(None), Student.section != "").distinct().all()
    sections = sorted(list({s[0].strip().upper() for s in section_rows if s[0]} | {"A", "B", "C"}))

    # Count of distinct admins who enrolled students
    admin_ids_with_students = db.query(Student.admin_id).distinct().count()

    # 2. Build filtered query
    query = db.query(Student)

    if admin_id:
        query = query.filter(Student.admin_id == admin_id)

    if search and search.strip():
        q = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.name.ilike(q),
                Student.register_number.ilike(q),
                Student.email.ilike(q),
                Student.phone.ilike(q),
                Student.department.ilike(q),
                Student.section.ilike(q)
            )
        )

    if department and department.strip() and department.lower() != "all":
        query = query.filter(func.lower(Student.department) == department.strip().lower())

    if year and year.strip() and year.lower() != "all":
        query = query.filter(func.lower(Student.year) == year.strip().lower())

    if section and section.strip() and section.lower() != "all":
        query = query.filter(func.upper(func.coalesce(Student.section, 'A')) == section.strip().upper())

    if status and status.strip() and status.lower() != "all":
        query = query.filter(func.lower(Student.status) == status.strip().lower())

    students = query.order_by(Student.name.asc(), Student.id.asc()).all()

    # Pre-fetch all admins
    all_admins = {u.id: u for u in db.query(User).filter(User.role == "ADMIN").all()}

    student_items = []
    for s in students:
        creator = all_admins.get(s.admin_id)
        student_items.append({
            "id": s.id,
            "name": s.name,
            "register_number": s.register_number,
            "email": s.email,
            "phone": s.phone or "—",
            "department": s.department or "—",
            "year": s.year or "—",
            "section": s.section or "A",
            "status": s.status or "Active",
            "admin_id": s.admin_id,
            "admin_name": creator.full_name if creator else "Master Administrator",
            "admin_email": creator.email if creator else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "date_added": s.created_at.strftime("%d-%m-%Y") if s.created_at else "—"
        })

    return {
        "students": student_items,
        "stats": {
            "total_students": total_count,
            "active_students": active_count,
            "inactive_students": inactive_count,
            "departments_count": len(departments),
            "admins_count": admin_ids_with_students
        },
        "departments": departments,
        "years": years,
        "sections": sections
    }


@router.put("/master-admin/students/{student_id}", response_model=StudentResponse)
def master_admin_update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Master Admin update of any student."""
    if not is_master_admin(admin):
        raise HTTPException(status_code=403, detail="Access Denied: Only Master Administrator can perform this action.")
    return update_student(student_id=student_id, payload=payload, db=db, admin=admin)


@router.delete("/master-admin/students/all")
def master_admin_delete_all_students(
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Master Admin delete all students across the entire institution."""
    if not is_master_admin(admin):
        raise HTTPException(status_code=403, detail="Access Denied: Only Master Administrator can perform this action.")
    return delete_all_students(admin_id=admin_id, db=db, admin=admin)


@router.delete("/master-admin/students/{student_id}")
def master_admin_delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Master Admin delete of any student."""
    if not is_master_admin(admin):
        raise HTTPException(status_code=403, detail="Access Denied: Only Master Administrator can perform this action.")
    return delete_student(student_id=student_id, db=db, admin=admin)
