import express from 'express';
import { 
  assignClassLeader, 
  removeClassLeader, 
  getClassLeader,
  checkClassLeaderRole,
  getStudentsLeader,
  postAcceptStudent,
  getLeaderLockStatus
} from '../controllers/classLeaderController.js';

const router = express.Router();

// Routes cho giáo viên quản lý lớp trưởng
router.post('/assign', assignClassLeader);
router.post('/remove', removeClassLeader);
router.get('/', getClassLeader);

// Route cho lớp trưởng kiểm tra quyền và lấy danh sách sinh viên
router.get('/check', checkClassLeaderRole);
router.get('/students', getStudentsLeader);
router.post('/accept', postAcceptStudent);
router.get('/lock-status', getLeaderLockStatus);

export default router;
