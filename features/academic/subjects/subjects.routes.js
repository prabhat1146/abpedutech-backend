const express = require("express");
const router = express.Router();

const {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
} = require("./subjects.controllers");

router.post("/createSubject", createSubject);
router.get("/getSubjects", getSubjects);
router.get("/:id", getSubjectById);
router.put("/:id", updateSubject);
router.delete("/:id", deleteSubject);

module.exports = router;