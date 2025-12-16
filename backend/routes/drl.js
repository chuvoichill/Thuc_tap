import express from "express";
import {getCriteriaController,getSelfAssessment,saveSelfAssessment,getStudentHistory,} from "../controllers/drlController.js";
import { previewTemplateExcel,exportTemplateExcel } from '../controllers/reportController.js';
import { uploadEvidence, getEvidenceByAssessment, deleteEvidence, serveEvidence } from '../controllers/evidenceController.js';
import upload from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.get("/criteria", getCriteriaController);
router.get("/self", getSelfAssessment);
router.post("/self", saveSelfAssessment);
router.get("/history", getStudentHistory);

// Evidence routes
router.post("/evidence/upload", upload.array('evidence', 5), (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File quá lớn. Kích thước tối đa là 10MB/file.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Quá nhiều file. Tối đa 5 file/lần.' });
    }
    if (err.message) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Lỗi upload file' });
  }
  next();
}, uploadEvidence); // Tối đa 5 file
router.get("/evidence", getEvidenceByAssessment);
router.delete("/evidence/:id", deleteEvidence);
router.get("/evidence/file/:filename", serveEvidence);

// Export Excel Template - không cần requireRole vì đã có protectedRoute
router.get("/excel-preview", previewTemplateExcel);
router.get("/excel-template", exportTemplateExcel);

export default router;
