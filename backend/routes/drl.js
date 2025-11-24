import express from "express";
import {getCriteriaController,getSelfAssessment,saveSelfAssessment,getStudentHistory,} from "../controllers/drlController.js";
import { exportTemplateExcel } from '../controllers/reportController.js';

const router = express.Router();

router.get("/criteria", getCriteriaController);
router.get("/self", getSelfAssessment);
router.post("/self", saveSelfAssessment);
router.get("/history", getStudentHistory);
// Export Excel Template
router.get("/excel-template", exportTemplateExcel);

export default router;
