import express from "express";
import {getGroups} from '../controllers/adminController.js';
import * as adminController from '../controllers/adminController.js';
const router = express.Router();

// Faculties & Classes
router.get('/faculties', adminController.getFaculties); // /api/admin/faculties?term=...
router.get('/classes', adminController.getClasses);    // /api/admin/classes?term=...[&faculty=...]
router.get('/class/students', adminController.getClassStudents); // Thêm route lấy student cho admin

// Groups 
router.get('/groups', getGroups);    // /api/admin/groups?term=...
router.post('/groups', adminController.createGroup);
router.put('/groups/:id', adminController.updateGroup);
router.delete('/groups/:id', adminController.deleteGroup);

// Criteria & Options
router.post('/criteria', adminController.createOrUpdateCriterion); // Tạo mới (hoặc upsert nếu logic controller hỗ trợ)
router.put('/criteria/:id', adminController.updateCriterion);    // Cập nhật theo ID
router.delete('/criteria/:id', adminController.deleteCriterion); // Xóa theo ID
router.put('/criteria/:id/options', adminController.updateCriterionOptions); // Cập nhật options

// --- TERM MANAGEMENT ---
// GET /api/admin/terms (Dùng hàm getAdminTerms đã sửa)
router.get('/terms', adminController.getAdminTerms);
router.post('/terms', adminController.createAdminTerm);
router.put('/terms/:termCode', adminController.updateAdminTerm);    
router.delete('/terms/:termCode', adminController.deleteAdminTerm);

// --- THÊM ROUTE MỚI ĐỂ CẬP NHẬT TRẠNG THÁI ---
// PUT /api/admin/terms/:termCode/status
router.put('/terms/:termCode/status', adminController.setTermAssessmentStatus);

// --- THÊM ROUTE MỚI CHO VIỆC SAO CHÉP ---
// POST /api/admin/criteria/copy
router.post('/criteria/copy', adminController.copyCriteriaFromTerm);

export default router;
// Class Search
router.get('/students/search', adminController.searchClass); 