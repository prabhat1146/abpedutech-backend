const AcademicStructure = require("../academicSchema");
const { success, error } = require("../../../utility/response");

// Create Subject
exports.createSubject = async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return error(res, null, "Subject ID and Subject Name are required.", 400);
    }

    const exists = await AcademicStructure.findOne({
      "subject.id": id,
    });

    if (exists) {
      return error(res, null, "Subject already exists.", 409);
    }

    const subject = await AcademicStructure.create({
      subject: {
        id,
        name,
      },
    });

    return success(res, subject, "Subject created successfully.", 201);
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Get All Subjects
exports.getSubjects = async (req, res) => {
  try {
    const subjects = await AcademicStructure.find(
      {},
      { subject: 1, _id: 0 }
    );

    return success(
      res,
      subjects,
      "Subjects fetched successfully.",
      200,
      {
        total: subjects.length,
      }
    );
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Get Subject By ID
exports.getSubjectById = async (req, res) => {
  try {
    const subject = await AcademicStructure.findOne(
      { "subject.id": req.params.id },
      { subject: 1, _id: 0 }
    );

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, subject, "Subject fetched successfully.");
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Update Subject
exports.updateSubject = async (req, res) => {
  try {
    const { name } = req.body;

    const subject = await AcademicStructure.findOneAndUpdate(
      { "subject.id": req.params.id },
      {
        $set: {
          "subject.name": name,
        },
      },
      {
        new: true,
      }
    );

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, subject, "Subject updated successfully.");
  } catch (err) {
    return error(res, null, err.message);
  }
};

// Delete Subject
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await AcademicStructure.findOneAndDelete({
      "subject.id": req.params.id,
    });

    if (!subject) {
      return error(res, null, "Subject not found.", 404);
    }

    return success(res, null, "Subject deleted successfully.");
  } catch (err) {
    return error(res, null, err.message);
  }
};