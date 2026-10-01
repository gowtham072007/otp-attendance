import os
import re
from typing import List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

try:
    from ..database import get_db
    from ..models import User, Student
    from ..schemas import (
        StudentCreate, 
        StudentUpdate, 
        StudentResponse, 
        MasterAdminStudentStats
    )
    from ..auth.utils import get_current_admin
except (ImportError, ValueError):
    from app.database import get_db
    from app.models import User, Student
    from app.schemas import (
        StudentCreate, 
        StudentUpdate, 
        StudentResponse, 
        MasterAdminStudentStats
    )
    from app.auth.utils import get_current_admin

router = APIRouter(tags=["students"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@francisxavier.ac.in").strip().lower()

def is_master_admin(admin: User) -> bool:
    if not admin or not admin.email:
        return False
    return admin.email.strip().lower() == INITIAL_ADMIN_EMAIL

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
    clean_status = (payload.status.strip().capitalize()) if payload.status else "Active"

    new_student = Student(
        name=clean_name,
        register_number=clean_reg_no,
        email=clean_email,
        phone=clean_phone,
        department=clean_dept,
        year=clean_year,
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
    status: Optional[str] = None,
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Get all students.
    - Regular Admin: Scoped strictly to their own registered students.
    - Master Admin: Can view all students or filter by specific admin.
    """
    query = db.query(Student)

    # Scope by Admin role
    if not is_master_admin(admin):
        query = query.filter(Student.admin_id == admin.id)
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
                Student.department.ilike(q)
            )
        )

    # Field filters
    if department and department.strip() and department.lower() != "all":
        query = query.filter(func.lower(Student.department) == department.strip().lower())

    if year and year.strip() and year.lower() != "all":
        query = query.filter(func.lower(Student.year) == year.strip().lower())

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

    if not is_master_admin(admin) and student.admin_id != admin.id:
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

    if not is_master_admin(admin) and student.admin_id != admin.id:
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

    if payload.department is not None:
        student.department = payload.department.strip() if payload.department else None

    if payload.year is not None:
        student.year = payload.year.strip() if payload.year else None

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


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Delete a student record and remove from authorization list."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not is_master_admin(admin) and student.admin_id != admin.id:
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


# --- 2. Master Admin Global Student List Routes ---

@router.get("/master-admin/students")
def get_master_admin_students(
    search: Optional[str] = None,
    department: Optional[str] = None,
    year: Optional[str] = None,
    status: Optional[str] = None,
    admin_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Master Admin endpoint to view and manage all students enrolled by all Admins.
    Returns student list, summary metrics, and distinct department/year filters.
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
    
    # Distinct departments and years for filter dropdowns
    dept_rows = db.query(Student.department).filter(Student.department.isnot(None), Student.department != "").distinct().all()
    departments = sorted([d[0] for d in dept_rows if d[0]])
    
    year_rows = db.query(Student.year).filter(Student.year.isnot(None), Student.year != "").distinct().all()
    years = sorted([y[0] for y in year_rows if y[0]])

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
                Student.department.ilike(q)
            )
        )

    if department and department.strip() and department.lower() != "all":
        query = query.filter(func.lower(Student.department) == department.strip().lower())

    if year and year.strip() and year.lower() != "all":
        query = query.filter(func.lower(Student.year) == year.strip().lower())

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
        "years": years
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
