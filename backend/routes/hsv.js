import express from "express";
import { getListClass,getListStudents,postConfirmAssessment, postUnconfirmAssessment } from '../controllers/hsvController.js';
const router = express.Router();

router.get('/classes', getListClass);
router.get('/class-students',getListStudents);
router.post('/confirm',postConfirmAssessment);
router.post('/unconfirm',postUnconfirmAssessment);

export default router;