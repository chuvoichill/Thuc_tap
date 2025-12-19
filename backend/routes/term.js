import express from "express";
import * as termController from '../controllers/termController.js';
const router = express.Router();

// GET /api/terms - Lấy danh sách tất cả học kỳ (cho dropdown)
router.get('/', termController.getAllTerms);
// GET /api/terms/:termCode/status
router.get('/:termCode/status', termController.getTermStatus);

export default router;