
const mongoose = require("mongoose");
const Chapter = require("../chapters/chapterSchema");
const Subject = require("../subjects/subjectSchema");

// CREATE CHAPTER
exports.createChapter = async (req, res) => {
  try {
    const { id, name, subject, description, isActive } = req.body;

    if (!id || !name || !subject) {
      return res.status(400).json({
        success: false,
        message: "id, name and subject are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(subject)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID",
      });
    }

    const subjectExists = await Subject.findById(subject);

    if (!subjectExists) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const existingChapter = await Chapter.findOne({ id: id.trim() });

    if (existingChapter) {
      return res.status(409).json({
        success: false,
        message: "Chapter ID already exists",
      });
    }

    const chapter = await Chapter.create({
      id,
      name,
      subject,
      description,
      isActive,
    });

    const populatedChapter = await Chapter.findById(chapter._id)
      .populate("subject");

    return res.status(201).json({
      success: true,
      message: "Chapter created successfully",
      data: populatedChapter,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Chapter ID already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET ALL CHAPTERS
exports.getAllChapters = async (req, res) => {
  try {
    const chapters = await Chapter.find()
      .populate("subject")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: chapters.length,
      data: chapters,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET SINGLE CHAPTER BY CUSTOM ID
exports.getChapterById = async (req, res) => {
  try {
    const chapter = await Chapter.findOne({ id: req.params.id })
      .populate("subject");

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// UPDATE CHAPTER BY CUSTOM ID
exports.updateChapter = async (req, res) => {
  try {
    const { name, subject, description, isActive } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    if (subject !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(subject)) {
        return res.status(400).json({
          success: false,
          message: "Invalid subject ID",
        });
      }

      const subjectExists = await Subject.findById(subject);

      if (!subjectExists) {
        return res.status(404).json({
          success: false,
          message: "Subject not found",
        });
      }

      updates.subject = subject;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const chapter = await Chapter.findOneAndUpdate(
      { id: req.params.id },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    ).populate("subject");

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chapter updated successfully",
      data: chapter,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE CHAPTER BY CUSTOM ID
exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findOneAndDelete({
      id: req.params.id,
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Chapter deleted successfully",
      data: chapter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
