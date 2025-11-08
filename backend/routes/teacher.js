import express from "express";
import {getAllStudents} from "../controllers/teacherController.js";

const router = express.Router();

// /api/teacher/students?username=...&term=...
router.get('/students',getAllStudents);

export default router;