const express = require("express");
const router = express.Router({ mergeParams: true });
const mockTestController = require("./sectionController");

// Add one section
router.post("/", mockTestController.addSection);

// Update all sections
router.patch("/", mockTestController.updateSections);

// Update one section
router.patch("/:sectionId", mockTestController.updateSection);

// Delete one section
router.delete("/:sectionId", mockTestController.deleteSection);

module.exports = router;