import express from "express";
import * as facultyClassController from '../controllers/adminController/faculty_classMController.js';
import * as groupController from '../controllers/adminController/groupMController.js';
import * as criteriaController from '../controllers/adminController/criteriaMController.js';
import * as semesterController from '../controllers/adminController/semesterMController.js';
import * as searchController from '../controllers/adminController/searchMController.js';

const router = express.Router();

// Faculties
router.get('/faculties', facultyClassController.getFaculties);
router.get('/class/students', facultyClassController.getClassStudents);
router.post('/approve', facultyClassController.postAcceptAdmin);

// Groups 
router.get('/groups', groupController.getGroups);
router.post('/groups', groupController.createGroup);
router.put('/groups/:id', groupController.updateGroup);
router.delete('/groups/:id', groupController.deleteGroup);

// Criteria & Options
router.post('/criteria', criteriaController.createCriterion);
router.put('/criteria/:id', criteriaController.updateCriterion);
router.delete('/criteria/:id', criteriaController.deleteCriterion);
router.delete('/criteria', criteriaController.deleteAllCriteriaAd);
router.put('/criteria/:id/options', criteriaController.updateCriterionOptions);
router.post('/criteria/copy', criteriaController.copyCriteriaFromTerm);

// Terms Management
router.get('/terms', semesterController.getAdminTerms);
router.post('/terms', semesterController.createAdminTerm);
router.put('/terms/:termCode', semesterController.updateAdminTerm);
router.delete('/terms/:termCode', semesterController.deleteAdminTerm);
router.put('/terms/:termCode/status', semesterController.setTermAssessmentStatus);

// Search
router.get('/students/search', searchController.searchClass);

export default router; 