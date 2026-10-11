
const express = require("express");
const router = express.Router();

const mockTestController = require("./mockTestController");
// const { protect, adminOnly } = require("../middleware/authMiddleware");

// Create a mock test
router.post(
  "/",
//   protect,
//   adminOnly,
  mockTestController.createMockTest
);

// Get all mock tests
router.get(
  "/",
//   protect,
//   adminOnly,
  mockTestController.getAllMockTests
);
//user
router.get(
  "/user-mock-test",
//   protect,
//   adminOnly,
  mockTestController.getAllMockTestsForUser
);

// Get a single mock test
router.get(
  "/:id",
//   protect,
//   adminOnly,
  mockTestController.getMockTestById
);

// Update a mock test
router.patch(
  "/:id",
//   protect,
//   adminOnly,
  mockTestController.updateMockTest
);

// Publish a mock test
router.patch(
  "/:id/publish",
//   protect,
//   adminOnly,
  mockTestController.publishMockTest
);

// Deactivate a mock test
router.patch(
  "/:id/deactivate",
//   protect,
//   adminOnly,
  mockTestController.deactivateMockTest
);

// Delete a mock test
router.delete(
  "/:id",
//   protect,
//   adminOnly,
  mockTestController.deleteMockTest
);




module.exports = router;
