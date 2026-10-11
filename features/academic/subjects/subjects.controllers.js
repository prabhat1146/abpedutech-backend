const Subject = require("../subjects/subjectSchema");
const { success, error } = require("../../../utility/response");

// Create Subject
exports.createSubject = async (req, res) => {
  try {
    const { id, name, class: className, course } = req.body;

    if (!id || !name) {
      return error(
        res,
        null,
        "Subject ID, name, class, and course are required.",
        400,
      );
    }

    const exists = await Subject.findOne({ id });

    if (exists) {
      return error(res, null, "Subject ID already exists.", 409);
    }

    const subject = await Subject.create({
      id,
      name,
      class: className,
      course,
    });

    return success(res, subject, "Subject created successfully.", 201);
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Get All Subjects
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: 1 });

    return success(res, subjects, "Subjects fetched successfully.", 200, {
      total: subjects.length,
    });
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Get Subject By Custom ID
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findOne({
      id: req.params.id,
    });

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, subject, "Subject fetched successfully.", 200);
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Update Subject

exports.updateSubject = async (req, res) => {
  try {
    const { name, class: className } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (className !== undefined) updates.class = className;

    if (Object.keys(updates).length === 0) {
      return error(res, null, "No fields provided to update.", 400);
    }

    const subject = await Subject.findOneAndUpdate(
      { id: req.params.id },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, subject, "Subject updated successfully.", 200);
  } catch (err) {
    console.error("Update Subject Error:", err);
    return error(res, null, err.message, 500);
  }
};

// Delete Subject
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findOneAndDelete({
      id: req.params.id,
    });

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, null, "Subject deleted successfully.", 200);
  } catch (err) {
    return error(res, null, err.message);
  }
};
