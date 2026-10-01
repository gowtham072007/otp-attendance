import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Filter, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  Mail, 
  Building2, 
  Calendar, 
  Download, 
  AlertCircle, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  UserCheck,
  UserX,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

const COMMON_DEPARTMENTS = [
  'Computer Science & Engineering (CSE)',
  'Information Technology (IT)',
  'Electronics & Communication (ECE)',
  'Electrical & Electronics (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
  'Artificial Intelligence & Data Science (AIDS)',
  'AI & Machine Learning (AIML)',
  'Master of Business Administration (MBA)',
  'Master of Computer Applications (MCA)'
];

const COMMON_YEARS = [
  '1st Year (I)',
  '2nd Year (II)',
  '3rd Year (III)',
  '4th Year (IV)'
];

const StudentManagement = ({ isMasterAdmin, currentUser }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Stats from backend (for Master Admin)
  const [stats, setStats] = useState({
    total_students: 0,
    active_students: 0,
    inactive_students: 0,
    departments_count: 0,
    admins_count: 0
  });

  // Admin filter list for Master Admin
  const [adminsList, setAdminsList] = useState([]);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedAdminId, setSelectedAdminId] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    register_number: '',
    email: '',
    phone: '',
    department: '',
    year: '',
    status: 'Active'
  });

  // Fetch Students from backend
  const fetchStudents = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      if (isMasterAdmin) {
        const params = {};
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedDept !== 'ALL') params.department = selectedDept;
        if (selectedYear !== 'ALL') params.year = selectedYear;
        if (selectedStatus !== 'ALL') params.status = selectedStatus;
        if (selectedAdminId !== 'ALL') params.admin_id = selectedAdminId;

        const res = await api.get('/master-admin/students', { params });
        setStudents(res.data.students || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      } else {
        const params = {};
        if (searchQuery.trim()) params.search = searchQuery.trim();
        if (selectedDept !== 'ALL') params.department = selectedDept;
        if (selectedYear !== 'ALL') params.year = selectedYear;
        if (selectedStatus !== 'ALL') params.status = selectedStatus;

        const res = await api.get('/students', { params });
        const list = res.data || [];
        setStudents(list);
        setStats({
          total_students: list.length,
          active_students: list.filter(s => s.status?.toLowerCase() === 'active').length,
          inactive_students: list.filter(s => s.status?.toLowerCase() !== 'active').length,
          departments_count: new Set(list.map(s => s.department).filter(Boolean)).size,
          admins_count: 1
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load students from the database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch Admins list for Master Admin filter dropdown
  const fetchAdmins = async () => {
    if (!isMasterAdmin) return;
    try {
      const res = await api.get('/admin/admins');
      setAdminsList(res.data || []);
    } catch {
      // Fallback silently if admins list cannot be fetched
    }
  };

  useEffect(() => {
    fetchStudents(true);
    if (isMasterAdmin) {
      fetchAdmins();
    }
  }, [isMasterAdmin, selectedDept, selectedYear, selectedStatus, selectedAdminId]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(false);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept('ALL');
    setSelectedYear('ALL');
    setSelectedStatus('ALL');
    setSelectedAdminId('ALL');
    setCurrentPage(1);
  };

  // Open modal for Adding new student
  const handleOpenAddModal = () => {
    setIsEditing(false);
    setEditingStudentId(null);
    setFormData({
      name: '',
      register_number: '',
      email: '',
      phone: '',
      department: COMMON_DEPARTMENTS[0],
      year: COMMON_YEARS[0],
      status: 'Active'
    });
    setFormError('');
    setModalOpen(true);
  };

  // Open modal for Editing student
  const handleOpenEditModal = (student) => {
    setIsEditing(true);
    setEditingStudentId(student.id);
    setFormData({
      name: student.name || '',
      register_number: student.register_number || '',
      email: student.email || '',
      phone: student.phone && student.phone !== '—' ? student.phone : '',
      department: student.department && student.department !== '—' ? student.department : COMMON_DEPARTMENTS[0],
      year: student.year && student.year !== '—' ? student.year : COMMON_YEARS[0],
      status: student.status || 'Active'
    });
    setFormError('');
    setModalOpen(true);
  };

  // Form input change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Form submission validation & API call
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validation
    const cleanName = formData.name.trim();
    const cleanRegNo = formData.register_number.trim().toUpperCase();
    const cleanEmail = formData.email.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Student Name is required.');
      return;
    }
    if (cleanName.length < 2) {
      setFormError('Student Name must be at least 2 characters.');
      return;
    }
    if (!cleanRegNo) {
      setFormError('Student ID / Register Number is required.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setFormError('A valid email address is required (e.g. student@francisxavier.ac.in).');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: cleanName,
        register_number: cleanRegNo,
        email: cleanEmail,
        phone: formData.phone.trim() || null,
        department: formData.department.trim() || null,
        year: formData.year.trim() || null,
        status: formData.status || 'Active'
      };

      if (isEditing) {
        const endpoint = isMasterAdmin ? `/master-admin/students/${editingStudentId}` : `/students/${editingStudentId}`;
        await api.put(endpoint, payload);
        setSuccessMsg(`Student '${cleanName}' updated successfully.`);
      } else {
        await api.post('/students', payload);
        setSuccessMsg(`Student '${cleanName}' (${cleanRegNo}) added successfully to database.`);
      }

      setModalOpen(false);
      fetchStudents(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save student record.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (student) => {
    const confirmMsg = `Are you sure you want to delete student:\n\n• Name: ${student.name}\n• ID / Register No: ${student.register_number}\n• Email: ${student.email}\n\nThis will remove the student from the database and whitelist.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const endpoint = isMasterAdmin ? `/master-admin/students/${student.id}` : `/students/${student.id}`;
      await api.delete(endpoint);
      setSuccessMsg(`Student '${student.name}' removed successfully.`);
      fetchStudents(false);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete student.');
    }
  };

  // Quick toggle status (Active <-> Inactive)
  const handleToggleStatus = async (student) => {
    const newStatus = student.status?.toLowerCase() === 'active' ? 'Inactive' : 'Active';
    try {
      const endpoint = isMasterAdmin ? `/master-admin/students/${student.id}` : `/students/${student.id}`;
      await api.put(endpoint, { status: newStatus });
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus } : s));
      setSuccessMsg(`Student '${student.name}' status set to ${newStatus}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update student status.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (students.length === 0) {
      alert('No student records to export.');
      return;
    }

    let csv = '\ufeff'; // UTF-8 BOM
    csv += 'S.No,Student Name,Student ID / Register No,Email,Phone Number,Department,Year / Class,Status,Added By Admin,Date Added\n';

    students.forEach((s, idx) => {
      const escape = (str) => `"${String(str || '—').replace(/"/g, '""')}"`;
      csv += `${idx + 1},${escape(s.name)},${escape(s.register_number)},${escape(s.email)},${escape(s.phone)},${escape(s.department)},${escape(s.year)},${escape(s.status)},${escape(s.admin_name || 'Admin')},${escape(s.date_added || s.created_at || '—')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pagination calculation
  const totalPages = Math.ceil(students.length / itemsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return students.slice(start, start + itemsPerPage);
  }, [students, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successMsg && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-800 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <GraduationCap size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Students</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {stats.total_students} Total
                </span>
                {isMasterAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Master Admin View
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {isMasterAdmin 
                  ? 'Institute-wide directory of all students registered by administrators across departments.'
                  : 'Manage students enrolled under your department. Added students automatically sync with the attendance roster.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => fetchStudents(false)}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh student list"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer shadow-xs"
            title="Export student directory as CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Users size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Total Enrolled</div>
            <div className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">{stats.total_students}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <UserCheck size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Active Students</div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{stats.active_students}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <UserX size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Inactive</div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{stats.inactive_students}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {isMasterAdmin ? 'Active Admins' : 'Departments'}
            </div>
            <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
              {isMasterAdmin ? stats.admins_count : stats.departments_count}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by student name, ID / register no, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {COMMON_DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Years</option>
              {COMMON_YEARS.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-36">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Master Admin Filter by Admin */}
          {isMasterAdmin && (
            <div className="w-full md:w-52">
              <select
                value={selectedAdminId}
                onChange={(e) => { setSelectedAdminId(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-300 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
              >
                <option value="ALL">All Enrolling Admins</option>
                {adminsList.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters button */}
          {(searchQuery || selectedDept !== 'ALL' || selectedYear !== 'ALL' || selectedStatus !== 'ALL' || selectedAdminId !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="flex items-center justify-center space-x-1 px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-400 transition-all cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Students Table / Cards View */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500" />
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Loading student directory from database...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <GraduationCap size={28} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No Students Found</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
                {searchQuery || selectedDept !== 'ALL' || selectedYear !== 'ALL' || selectedStatus !== 'ALL'
                  ? 'No students matched your search criteria. Try resetting the filters.'
                  : 'Start by clicking "Add Student" above to enroll students into the central database.'}
              </p>
            </div>
            {!(searchQuery || selectedDept !== 'ALL' || selectedYear !== 'ALL' || selectedStatus !== 'ALL') && (
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                <Plus size={14} />
                <span>Add First Student</span>
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Desktop / Tablet Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-950/60 font-mono text-zinc-500 dark:text-zinc-400 text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Student Name</th>
                    <th className="py-3.5 px-4 font-semibold">Student ID / Reg No</th>
                    <th className="py-3.5 px-4 font-semibold">Email</th>
                    <th className="py-3.5 px-4 font-semibold">Phone</th>
                    <th className="py-3.5 px-4 font-semibold">Department</th>
                    <th className="py-3.5 px-4 font-semibold">Year / Class</th>
                    {isMasterAdmin && (
                      <th className="py-3.5 px-4 font-semibold">Added By Admin</th>
                    )}
                    <th className="py-3.5 px-4 font-semibold">Date Added</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedStudents.map((student) => {
                    const isActive = student.status?.toLowerCase() === 'active';
                    return (
                      <tr 
                        key={student.id}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* Student Name */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            {student.name}
                          </div>
                        </td>

                        {/* Register Number */}
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {student.register_number}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                          {student.email}
                        </td>

                        {/* Phone */}
                        <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400">
                          {student.phone || '—'}
                        </td>

                        {/* Department */}
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                          <span className="inline-block max-w-[150px] truncate" title={student.department}>
                            {student.department || '—'}
                          </span>
                        </td>

                        {/* Year */}
                        <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                          {student.year || '—'}
                        </td>

                        {/* Added By Admin (Master Admin Only) */}
                        {isMasterAdmin && (
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900 dark:text-zinc-200">
                                {student.admin_name || 'Master Admin'}
                              </span>
                              {student.admin_email && (
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {student.admin_email}
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Date Added */}
                        <td className="py-3 px-4 font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                          {student.date_added || (student.created_at ? new Date(student.created_at).toLocaleDateString('en-GB') : '—')}
                        </td>

                        {/* Status (Clickable toggle) */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleStatus(student)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200'
                            }`}
                            title="Click to toggle status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`}></span>
                            <span>{student.status || 'Active'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenEditModal(student)}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              title="Edit Student"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(student)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete Student"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center space-x-2">
                <span>Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, students.length)} of {students.length} students</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono cursor-pointer"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="px-3 py-1 font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {isEditing ? 'Edit Student Details' : 'Enroll New Student'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {isEditing ? 'Update student records in the database.' : 'Enter student credentials to save to central database.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Student Name */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Student Full Name *</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Register Number / Student ID */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Student ID / Reg No *
                  </label>
                  <input
                    type="text"
                    name="register_number"
                    value={formData.register_number}
                    onChange={handleFormChange}
                    placeholder="e.g. 950821104001"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleFormChange}
                    placeholder="e.g. student@francisxavier.ac.in"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Enrollment Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                {/* Department */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Department
                  </label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {COMMON_DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Year / Class */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Year / Class
                  </label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    {COMMON_YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{isEditing ? 'Save Changes' : 'Add Student'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
