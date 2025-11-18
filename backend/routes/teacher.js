import express from "express";
import {getAllStudents, getStudentAssessment, saveStudentAssessment} from "../controllers/teacherController.js";

const router = express.Router();

// /api/teacher/students?username=...&term=...
router.get('/students',getAllStudents);

// GET /api/teacher/assessment?student_code=671001&term=2025HK2
router.get('/assessment', getStudentAssessment);

// POST /api/teacher/assessment
router.post('/assessment', saveStudentAssessment);

export default router;