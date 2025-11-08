import express from "express";
import { getClasses,getClassStudents,postConfirmAssessment } from '../controllers/hsvController.js';
const router = express.Router();

router.get('/classes', getClasses);
router.get('/class-students',getClassStudents);
router.post('/confirm',postConfirmAssessment);

export default router;