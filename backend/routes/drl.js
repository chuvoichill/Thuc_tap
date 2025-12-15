import express from "express";
import {getCriteriaController,getSelfAssessment,saveSelfAssessment,getStudentHistory,} from "../controllers/drlController.js";
import { previewTemplateExcel,exportTemplateExcel } from '../controllers/reportController.js';

const router = express.Router();

router.get("/criteria", getCriteriaController);
router.get("/self", getSelfAssessment);
router.post("/self", saveSelfAssessment);
router.get("/history", getStudentHistory);
// Export Excel Template - không cần requireRole vì đã có protectedRoute
router.get("/excel-preview", previewTemplateExcel);
router.get("/excel-template", exportTemplateExcel);

export default router;
