import express from "express";
import {getAllStudents, getAllStudentsNot, postStudentNotAss, getAllStudentsInClassController, postAcceptStudent} from "../controllers/teacherController.js";

const router = express.Router();

// /api/teacher/students?username=...&term=...
router.get('/students',getAllStudents);
router.get('/students/all',getAllStudentsInClassController);
router.get('/students/unRated', getAllStudentsNot)
router.post('/students/scoreToZero', postStudentNotAss)
router.post('/accept', postAcceptStudent);

export default router;