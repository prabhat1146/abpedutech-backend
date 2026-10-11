
const express = require("express");
const router = express.Router();

const {
  createChapter,
  getAllChapters,
  getChapterById,
  updateChapter,
  deleteChapter,
} = require("../chapters/chapterControllers");

router.post("/createChapter", createChapter);
router.get("/getAllChapters", getAllChapters);
router.get("/:id", getChapterById);
router.patch("/:id", updateChapter);
router.delete("/:id", deleteChapter);

module.exports = router;
