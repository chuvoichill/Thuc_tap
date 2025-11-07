import api from './api';

// --- DRL CORE APIs ---
export const getCriteria = (term) => {
  return api.get(`/api/drl/criteria?term=${encodeURIComponent(term)}`);
};

export const getSelfAssessment = (student_code, term) => {
  return api.get(`/api/drl/self?student_code=${encodeURIComponent(student_code)}&term=${encodeURIComponent(term)}`);
};

export const saveSelfAssessment = (student_code, term_code, items) => {
  return api.post('/api/drl/self', { student_code, term_code, items });
};

// Lấy danh sách tất cả học kỳ (dùng chung cho dropdown)
export const getTerms = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  // Gọi API chung, không cần quyền admin
  return api.get(`/api/terms?${query}`);
};

// --- STUDENT HISTORY API ---
export const getStudentHistory = (student_code) => {
  return api.get(`/api/drl/history?student_code=${encodeURIComponent(student_code)}`);
};

// --- TEACHER APIs ---
export const getTeacherStudents = (username, term) => {
  return api.get(`/api/teacher/students?username=${encodeURIComponent(username)}&term=${encodeURIComponent(term)}`);
};

// --- FACULTY APIs ---
export const getFacultyClasses = (username, term) => {
  return api.get(`/api/faculty/classes?username=${encodeURIComponent(username)}&term=${encodeURIComponent(term)}`);
};

export const getFacultyClassStudents = (username, class_code, term) => {
  return api.get(
    `/api/faculty/class/students?username=${encodeURIComponent(username)}&class_code=${encodeURIComponent(class_code)}&term=${encodeURIComponent(term)}`
  );
};

// --- HSV APIs ---
export const getHSVClasses = (username, term) => {
  return api.get(`/api/hsv/classes?username=${encodeURIComponent(username)}&term=${encodeURIComponent(term)}`);
};

export const getHSVClassStudents = (class_code, term) => {
  return api.get(`/api/hsv/class-students?class_code=${encodeURIComponent(class_code)}&term=${encodeURIComponent(term)}`);
};

export const confirmHSVAssessment = (student_code, term_code, participated, note, username) => {
  return api.post('/api/hsv/confirm', {
    student_code,
    term_code,
    participated,
    note,
    username
  });
};

// --- ADMIN VIEW APIs ---
export const getAdminFaculties = (term) => {
  return api.get(`/api/admin/faculties?term=${encodeURIComponent(term)}`);
};

export const getAdminClasses = (term, facultyCode = null) => {
  let url = `/api/admin/classes?term=${encodeURIComponent(term)}`;
  if (facultyCode) {
    url += `&faculty=${encodeURIComponent(facultyCode)}`;
  }
  return api.get(url);
};

// Common API used by Admin, Faculty, etc. to get students of a specific class
export const getAdminClassStudents = (class_code, term) => {
  return api.get(`/api/admin/class/students?class_code=${encodeURIComponent(class_code)}&term=${encodeURIComponent(term)}`);
};

// Admin Search Student API (Assumed endpoint)
export const searchAdminStudents = (queryParams) => {
  const params = new URLSearchParams();
  if (queryParams.studentCode) params.append('studentCode', queryParams.studentCode);
  if (queryParams.name) params.append('name', queryParams.name);
  if (queryParams.classCode) params.append('classCode', queryParams.classCode);
  return api.get(`/api/admin/students/search?${params.toString()}`);
};


// --- ADMIN CRITERIA MANAGEMENT APIs ---
export const getAdminGroups = (term) => {
  return api.get(`/api/admin/groups?term=${encodeURIComponent(term)}`);
};

// <-- THÊM MỚI -->
export const createAdminGroup = (groupData) => {
  // groupData nên chứa { term_code, code, title, display_order }
  return api.post('/api/admin/groups', groupData);
};

export const updateAdminGroup = (id, groupData) => {
  // groupData nên chứa { code, title, display_order }
  return api.put(`/api/admin/groups/${id}`, groupData);
};

// <-- THÊM MỚI -->
export const deleteAdminGroup = (id) => {
  return api.delete(`/api/admin/groups/${id}`);
};

export const createCriterion = (criterionData) => {
  return api.post('/api/admin/criteria', criterionData);
};

export const updateCriterion = (id, criterionData) => {
  return api.put(`/api/admin/criteria/${id}`, criterionData);
};

export const deleteCriterion = (id) => {
  return api.delete(`/api/admin/criteria/${id}`);
};

export const updateCriterionOptions = (criterionId, options) => {
  return api.put(`/api/admin/criteria/${criterionId}/options`, { options });
};


// --- ADMIN USER MANAGEMENT APIs (Assumed) ---
export const getAdminUsers = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/api/admin/users?${query}`);
};
export const getAdminUserById = (userId) => {
  return api.get(`/api/admin/users/${userId}`);
};
export const createAdminUser = (userData) => {
  return api.post('/api/admin/users', userData);
};
export const updateAdminUser = (userId, userData) => {
  return api.put(`/api/admin/users/${userId}`, userData);
};
export const deleteAdminUser = (userId) => {
  return api.delete(`/api/admin/users/${userId}`);
};


// --- ADMIN CLASS MANAGEMENT APIs (Assumed) ---
export const getAdminManageClasses = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/api/admin/classes/manage?${query}`);
};
export const getAdminClassById = (classId) => {
  return api.get(`/api/admin/classes/manage/${classId}`);
};
export const createAdminClass = (classData) => {
  return api.post('/api/admin/classes/manage', classData);
};
export const updateAdminClass = (classId, classData) => {
  return api.put(`/api/admin/classes/manage/${classId}`, classData);
};
export const deleteAdminClass = (classId) => {
  return api.delete(`/api/admin/classes/manage/${classId}`);
};


// --- ADMIN FACULTY MANAGEMENT APIs (Assumed) ---
export const getAdminManageFaculties = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api.get(`/api/admin/faculties/manage?${query}`);
};
export const getAdminFacultyById = (facultyId) => {
  return api.get(`/api/admin/faculties/manage/${facultyId}`);
};
export const createAdminFaculty = (facultyData) => {
  return api.post('/api/admin/faculties/manage', facultyData);
};
export const updateAdminFaculty = (facultyId, facultyData) => {
  return api.put(`/api/admin/faculties/manage/${facultyId}`, facultyData);
};
export const deleteAdminFaculty = (facultyId) => {
  return api.delete(`/api/admin/faculties/manage/${facultyId}`);
};


// --- ADMIN TERM MANAGEMENT APIs ---
// **ADDED/CORRECTED EXPORTS BELOW**
export const getAdminTerms = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  // Calls the backend endpoint that includes assessment status
  return api.get(`/api/admin/terms?${query}`);
};

export const createAdminTerm = (termData) => {
  return api.post('/api/admin/terms', termData);
};

export const updateAdminTerm = (termCode, termData) => {
  return api.put(`/api/admin/terms/${termCode}`, termData);
};

export const deleteAdminTerm = (termCode) => {
  return api.delete(`/api/admin/terms/${termCode}`);
};

// This function was already correctly defined
export const setTermAssessmentStatus = (termCode, isOpen) => {
  return api.put(`/api/admin/terms/${termCode}/status`, { isOpen });
};


// --- REFERENCE DATA APIs (Assumed/Examples) ---
// Gets list of roles for dropdowns
export const getRoles = () => {
   return api.get('/api/ref/roles'); // Assumes this endpoint exists
}
// Gets simple list of faculties for dropdowns
export const getAllFacultiesSimple = () => {
   return api.get('/api/ref/faculties'); // Assumes this endpoint exists
}

// --- REVIEW APIs (Assumed) ---
export const submitReview = (reviewerRole, studentCode, termCode, reviewData) => {
  const endpoint = reviewerRole === 'teacher' ? '/api/teacher/review' : '/api/faculty/review';
  return api.post(endpoint, {
    studentCode,
    termCode,
    ...reviewData
  });
};
export const getReviewDetails = (reviewerRole, studentCode, termCode) => {
   const endpoint = reviewerRole === 'teacher' ? '/api/teacher/review' : '/api/faculty/review';
   // Added encodeURIComponent for safety
   return api.get(`${endpoint}?studentCode=${encodeURIComponent(studentCode)}&termCode=${encodeURIComponent(termCode)}`);
}

export const copyCriteriaFromTerm = (sourceTermCode, targetTermCode) => {
  return api.post('/api/admin/criteria/copy', { sourceTermCode, targetTermCode });
};