import express from "express";
import * as facultyController from '../controllers/facultyController.js';
const router = express.Router();
 
//Lấy toàn bộ sinh viên của khoa theo kỳ
router.get('/students', facultyController.getAllFacultyStudents);
 
// Khoa chỉnh sửa điểm sinh viên
router.post('/student/update-score', facultyController.updateStudentScore);
 
// Khoa duyệt lớp
router.post('/class/approve', facultyController.approveClass);

// Kiểm tra trạng thái khóa
router.get('/lock-status', facultyController.getFacultyLockStatus);

export default router;