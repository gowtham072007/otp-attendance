import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  Link2, 
  Users, 
  GraduationCap, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Building2, 
  Calendar, 
  X, 
  Layers, 
  ShieldCheck,
  RefreshCw,
  UserCheck,
  Check,
  ChevronRight
} from 'lucide-react';

const COMMON_DEPARTMENTS = [
  'Artificial Intelligence & Data Science (AIDS)',
  'Computer Science & Engineering (CSE)',
  'Information Technology (IT)',
  'Electronics & Communication (ECE)',
  'Electrical & Electronics (EEE)',
  'Mechanical Engineering (MECH)',
  'Civil Engineering (CIVIL)',
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

const COMMON_SECTIONS = ['A', 'B', 'C', 'D', 'E'];

const AdminClassLinks = () => {
  const [classLinks, setClassLinks] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [selectedYearFilter, setSelectedYearFilter] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    department: COMMON_DEPARTMENTS[0],
    customDepartment: '',
    year: COMMON_YEARS[1], // 2nd Year default
    section: 'A',
    admin_ids: []
  });

  const [useCustomDept, setUseCustomDept] = useState(false);

  // Fetch Class Links
  const fetchClassLinks = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const [linksRes, adminsRes] = await Promise.all([
        api.get('/admin/class-links'),
        api.get('/admin/admins')
      ]);
      setClassLinks(linksRes.data || []);
      setAdminsList(adminsRes.data || []);
    } catch (err) {
      console.error('Failed to load class links:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClassLinks(true);
  }, []);

  // Filtered Class Links
  const filteredLinks = useMemo(() => {
    return classLinks.filter((link) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        link.department?.toLowerCase().includes(q) ||
        link.year?.toLowerCase().includes(q) ||
        link.section?.toLowerCase().includes(q) ||
        link.class_name?.toLowerCase().includes(q) ||
        link.linked_admins?.some(a => 
          a.full_name?.toLowerCase().includes(q) || 
          a.email?.toLowerCase().includes(q)
        );

      const matchesDept = selectedDeptFilter === 'ALL' || link.department === selectedDeptFilter;
      const matchesYear = selectedYearFilter === 'ALL' || link.year === selectedYearFilter;

      return matchesSearch && matchesDept && matchesYear;
    });
  }, [classLinks, searchQuery, selectedDeptFilter, selectedYearFilter]);

  // Overall Stats
  const stats = useMemo(() => {
    const totalLinks = classLinks.reduce((acc, l) => acc + (l.admin_ids?.length || 0), 0);
    const uniqueClasses = classLinks.length;
    const allAdminIds = new Set();
    let totalStudents = 0;
    classLinks.forEach((l) => {
      (l.admin_ids || []).forEach(id => allAdminIds.add(id));
      totalStudents += (l.students_count || 0);
    });
    return {
      totalLinks,
      uniqueClasses,
      uniqueAdmins: allAdminIds.size,
      totalStudents
    };
  }, [classLinks]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setUseCustomDept(false);
    setFormError('');
    setFormSuccess('');
    setFormData({
      department: COMMON_DEPARTMENTS[0],
      customDepartment: '',
      year: COMMON_YEARS[1],
      section: 'A',
      admin_ids: adminsList.length > 0 ? [adminsList[0].id] : []
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (link) => {
    setIsEditing(true);
    setFormError('');
    setFormSuccess('');
    const isCustom = !COMMON_DEPARTMENTS.includes(link.department);
    setUseCustomDept(isCustom);
    setFormData({
      department: isCustom ? 'CUSTOM' : link.department,
      customDepartment: isCustom ? link.department : '',
      year: link.year,
      section: link.section || 'A',
      admin_ids: link.admin_ids || []
    });
    setModalOpen(true);
  };

  // Toggle Admin selection checkbox
  const handleToggleAdmin = (adminId) => {
    setFormData((prev) => {
      const exists = prev.admin_ids.includes(adminId);
      const nextIds = exists 
        ? prev.admin_ids.filter(id => id !== adminId)
        : [...prev.admin_ids, adminId];
      return { ...prev, admin_ids: nextIds };
    });
  };

  // Save Link (Create or Edit)
  const handleSaveLink = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const finalDept = useCustomDept 
      ? formData.customDepartment.trim() 
      : formData.department.trim();

    if (!finalDept) {
      setFormError('Department name is required.');
      return;
    }

    if (!formData.year) {
      setFormError('Year / Class is required.');
      return;
    }

    if (!formData.section?.trim()) {
      setFormError('Section is required.');
      return;
    }

    if (formData.admin_ids.length === 0) {
      setFormError('Please select at least one Admin to link to this class roster.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        department: finalDept,
        year: formData.year,
        section: formData.section.trim().toUpperCase(),
        admin_ids: formData.admin_ids
      };

      if (isEditing) {
        await api.put('/admin/class-links', payload);
      } else {
        await api.post('/admin/class-links', payload);
      }

      setFormSuccess(isEditing ? 'Class link updated successfully!' : 'Class link created successfully!');
      await fetchClassLinks(false);
      setTimeout(() => {
        setModalOpen(false);
      }, 700);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save class link.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Remove Entire Class Link
  const handleRemoveClassLink = async (link) => {
    const confirmMsg = `⚠️ Are you sure you want to remove the class link for:\n\n${link.department}\n${link.year} - Section ${link.section}?\n\n(IMPORTANT: Students will remain in the database. Only admin class links are removed.)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.delete('/admin/class-links', {
        params: {
          department: link.department,
          year: link.year,
          section: link.section
        }
      });
      await fetchClassLinks(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove class link.');
    }
  };

  // Remove Single Admin from Class
  const handleRemoveAdminFromClass = async (link, adminId, adminName) => {
    const confirmMsg = `Remove ${adminName} from ${link.year} / ${link.section} (${link.department})?\n\n(Students will not be deleted; only this admin's access will be removed.)`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.delete('/admin/class-links', {
        params: {
          department: link.department,
          year: link.year,
          section: link.section,
          admin_id: adminId
        }
      });
      await fetchClassLinks(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove admin from class.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-zinc-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-purple-800/40">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider border border-purple-500/30">
              <Link2 size={13} />
              <span>SHARED CLASS ROSTER</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Admin Class Links
            </h2>
            <p className="text-sm text-purple-200/80 max-w-2xl leading-relaxed">
              Link multiple Class Teachers and Administrators to the same Class/Section. All linked Admins immediately share access to the same student roster and attendance sessions without duplicating student records.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => fetchClassLinks(false)}
              disabled={refreshing}
              className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl border border-white/15 transition cursor-pointer backdrop-blur-md"
              title="Refresh Links"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-2 px-5 py-3 bg-white text-zinc-900 hover:bg-purple-50 active:scale-95 rounded-2xl font-bold text-xs uppercase font-mono tracking-wider transition shadow-lg cursor-pointer shrink-0"
            >
              <Plus size={16} className="text-purple-600 stroke-[3]" />
              <span>Link Admins</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-2">
            <Layers size={20} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Unique Classes</span>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">{stats.uniqueClasses}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Configured class sections</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
            <Users size={20} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Linked Admins</span>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">{stats.uniqueAdmins}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Class teachers assigned</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <GraduationCap size={20} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Students</span>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">{stats.totalStudents}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Students in linked classes</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-2">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Link Bindings</span>
          </div>
          <div className="text-2xl font-black font-mono text-zinc-900 dark:text-zinc-100">{stats.totalLinks}</div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Active class permissions</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search class, section, department, or admin name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-mono border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-none focus:border-purple-500 transition cursor-pointer"
          >
            <option value="ALL">All Departments</option>
            {COMMON_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedYearFilter}
            onChange={(e) => setSelectedYearFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-mono border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-none focus:border-purple-500 transition cursor-pointer"
          >
            <option value="ALL">All Years</option>
            {COMMON_YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Class Links Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-bold">
                <th className="p-4 pl-6">Class / Section</th>
                <th className="p-4">Department</th>
                <th className="p-4">Year</th>
                <th className="p-4">Linked Admins</th>
                <th className="p-4 text-center">Students</th>
                <th className="p-4">Created Date</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-zinc-400 font-mono text-xs">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw size={16} className="animate-spin text-purple-600" />
                      <span>Loading admin class links...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-zinc-400 dark:text-zinc-500 font-mono text-xs">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mx-auto border border-purple-200 dark:border-purple-800/60">
                        <Link2 size={24} />
                      </div>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">No Admin Class Links Found</p>
                      <p className="text-zinc-500 text-[11px]">
                        Link administrators to class sections so they can view and manage the shared student roster.
                      </p>
                      <button
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold font-mono hover:bg-purple-700 transition cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Link Admins Now</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLinks.map((link, idx) => (
                  <tr key={`${link.department}-${link.year}-${link.section}-${idx}`} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-mono font-black text-xs flex items-center justify-center border border-purple-200 dark:border-purple-800/60 shrink-0">
                          {link.section}
                        </div>
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                            <span>{link.class_name || `${link.year} / ${link.section}`}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">
                            Sec {link.section}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 max-w-xs">
                        {link.department}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {link.year}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {link.linked_admins?.map((adminObj) => (
                          <span
                            key={adminObj.id}
                            className="inline-flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 group"
                            title={adminObj.email}
                          >
                            <span>{adminObj.full_name || adminObj.email}</span>
                            <button
                              onClick={() => handleRemoveAdminFromClass(link, adminObj.id, adminObj.full_name || adminObj.email)}
                              className="text-zinc-400 hover:text-rose-600 p-0.5 rounded-sm transition cursor-pointer"
                              title={`Remove ${adminObj.full_name} from this class`}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        {link.students_count || 0}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {link.formatted_date || '—'}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(link)}
                          className="p-1.5 text-zinc-600 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition border border-transparent hover:border-purple-200 dark:hover:border-purple-800 cursor-pointer"
                          title="Edit Linked Admins"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleRemoveClassLink(link)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 cursor-pointer"
                          title="Remove Class Link"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Link Admins to Class (Create / Edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-200 dark:border-purple-800">
                  <Link2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    {isEditing ? 'Edit Class Roster Link' : 'Link Admins to Class'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Multiple admins can share and manage this class roster
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveLink} className="space-y-4">
              {/* Department */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Department
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseCustomDept(!useCustomDept)}
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-mono cursor-pointer"
                  >
                    {useCustomDept ? 'Select Standard List' : 'Enter Custom Department'}
                  </button>
                </div>
                {useCustomDept ? (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    value={formData.customDepartment}
                    onChange={(e) => setFormData({ ...formData, customDepartment: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs outline-none focus:border-purple-500 transition"
                  />
                ) : (
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs outline-none focus:border-purple-500 transition cursor-pointer"
                  >
                    {COMMON_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Year & Section Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Year / Class
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs font-mono outline-none focus:border-purple-500 transition cursor-pointer"
                  >
                    {COMMON_YEARS.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Section
                  </label>
                  <select
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs font-mono font-bold outline-none focus:border-purple-500 transition cursor-pointer"
                  >
                    {COMMON_SECTIONS.map((sec) => (
                      <option key={sec} value={sec}>Section {sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select Admins (Checkboxes) */}
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Select Linked Admins (Class Teachers)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                  {adminsList.length === 0 ? (
                    <p className="text-xs text-zinc-400 font-mono text-center py-4">No administrators available.</p>
                  ) : (
                    adminsList.map((admin) => {
                      const isSelected = formData.admin_ids.includes(admin.id);
                      return (
                        <div
                          key={admin.id}
                          onClick={() => handleToggleAdmin(admin.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-950 dark:text-purple-200'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center transition border ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600 text-white'
                                : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950'
                            }`}>
                              {isSelected && <Check size={12} className="stroke-[3]" />}
                            </div>
                            <div>
                              <div className="font-bold text-xs">
                                {admin.full_name || 'Administrator'}
                                {admin.is_master && (
                                  <span className="ml-1.5 text-[9px] px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded font-mono">
                                    Master
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">{admin.email}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl text-[11px] text-purple-800 dark:text-purple-300">
                💡 <strong>Important:</strong> All selected Admins will see the same student roster for this class. If one Admin adds a student, all linked Admins will see that student.
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold font-mono uppercase tracking-wider transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving Link...' : 'Save Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClassLinks;
