
const express = require("express");
const router = express.Router();

const mockTestAttemptController = require("../controllers/mockTestAttemptController");

const { protect } = require("../middleware/authMiddleware");

// ==========================================
// STUDENT MOCK TEST ATTEMPT ROUTES
// Base URL: /api/mock-test-attempts
// ==========================================

// Start or resume a mock test
router.post(
  "/:id/start",
  protect,
  mockTestAttemptController.startMockTest
);

// Save or update an answer
router.put(
  "/:attemptId/answer",
  protect,
  mockTestAttemptController.saveAnswer
);

// Submit a mock test
router.post(
  "/:attemptId/submit",
  protect,
  mockTestAttemptController.submitMockTest
);

// Get a student's own attempt and result
router.get(
  "/:attemptId",
  protect,
  mockTestAttemptController.getMyAttempt
);

module.exports = router;
