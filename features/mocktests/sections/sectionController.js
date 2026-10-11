
const mongoose = require("mongoose");
const MockTest = require("../mocktest.model");
const { success, error } = require("../../../utility/response");

// ==========================================
// SECTION EDITABLE FIELDS
// ==========================================
const sectionEditableFields = [
  "sectionId",
  "title",
  "description",
  "instructions",
  "questions",
  "marksPerQuestion",
  "negativeMarking",
  "negativeMarksPerQuestion",
  "duration",
  "order",
  "isOptional",
  "status",
];

// ==========================================
// PICK ALLOWED SECTION FIELDS
// ==========================================
const pickSectionFields = (body = {}) => {
  const result = {};

  for (const field of sectionEditableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
};

// ==========================================
// VALIDATE NUMBER
// ==========================================
const validateNumber = (
  value,
  field,
  { min = 0, integer = false } = {}
) => {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return `${field} must be a valid number.`;
  }

  const number = Number(value);

  if (number < min) {
    return `${field} must be at least ${min}.`;
  }

  if (integer && !Number.isInteger(number)) {
    return `${field} must be an integer.`;
  }

  return null;
};

// ==========================================
// VALIDATE SECTION DATA
// ==========================================
const validateSectionData = (data, creating = false) => {
  const errors = [];

  // Section ID
  if (creating || data.sectionId !== undefined) {
    if (
      typeof data.sectionId !== "string" ||
      !data.sectionId.trim()
    ) {
      errors.push("Section ID is required.");
    } else {
      data.sectionId = data.sectionId.trim();
    }
  }

  // Title
  if (creating || data.title !== undefined) {
    if (
      typeof data.title !== "string" ||
      !data.title.trim()
    ) {
      errors.push("Section title is required.");
    } else {
      data.title = data.title.trim();
    }
  }

  // Text fields
  for (const field of ["description", "instructions"]) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== "string") {
        errors.push(`${field} must be a string.`);
      } else {
        data[field] = data[field].trim();
      }
    }
  }

  // Questions
  if (data.questions !== undefined) {
    if (!Array.isArray(data.questions)) {
      errors.push("Questions must be an array.");
    } else {
      const invalidQuestion = data.questions.some(
        (questionId) =>
          typeof questionId !== "string" &&
          !(questionId instanceof mongoose.Types.ObjectId)
      ) || data.questions.some(
        (questionId) =>
          !mongoose.Types.ObjectId.isValid(questionId)
      );

      if (invalidQuestion) {
        errors.push(
          "Each question must contain a valid MongoDB ObjectId."
        );
      } else {
        data.questions = data.questions.map((questionId) =>
          String(questionId)
        );
      }
    }
  }

  // Numeric fields matching the schema
  const numericFields = [
    ["marksPerQuestion", 0, false],
    ["negativeMarksPerQuestion", 0, false],
    ["duration", 0, true],
    ["order", 1, true],
  ];

  for (const [field, min, integer] of numericFields) {
    if (data[field] !== undefined) {
      const validationError = validateNumber(data[field], field, {
        min,
        integer,
      });

      if (validationError) {
        errors.push(validationError);
      } else {
        data[field] = Number(data[field]);
      }
    }
  }

  // Boolean fields
  for (const field of ["negativeMarking", "isOptional"]) {
    if (
      data[field] !== undefined &&
      typeof data[field] !== "boolean"
    ) {
      errors.push(`${field} must be true or false.`);
    }
  }

  // Status must match the schema enum
  if (
    data.status !== undefined &&
    !["Active", "Inactive"].includes(data.status)
  ) {
    errors.push("Section status must be Active or Inactive.");
  }

  return errors;
};

// ==========================================
// FIND MOCK TEST
// Supports custom ID and MongoDB _id
// ==========================================
const findMockTest = async (id) => {
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }

  const identifier = id.trim();

  const byCustomId = await MockTest.findOne({
    id: identifier,
  });

  if (byCustomId) {
    return byCustomId;
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    return MockTest.findById(identifier);
  }

  return null;
};

// ==========================================
// UPDATE AUDIT FIELD
// ==========================================
const setUpdatedBy = (mockTest, req) => {
  if (req.user?._id && mockTest.schema.path("updatedBy")) {
    mockTest.updatedBy = req.user._id;
  }
};

// ==========================================
// HANDLE API ERRORS
// ==========================================
const handleError = (res, err) => {
  console.error("Section API error:", err);

  if (err.name === "ValidationError") {
    return error(res, null, "Validation failed.", 400, [
      err.message,
    ]);
  }

  if (err.name === "CastError") {
    return error(res, null, "Invalid ID or field format.", 400);
  }

  if (err.code === 11000) {
    return error(res, null, "Duplicate value detected.", 409);
  }

  return error(res, null, "Internal server error.", 500);
};

// ==========================================
// VALIDATE COMPLETE SECTIONS ARRAY
// ==========================================
const validateSectionsArray = (sections) => {
  if (!Array.isArray(sections)) {
    return {
      errors: ["Sections must be provided as an array."],
      sections: [],
    };
  }

  const validatedSections = [];
  const sectionIds = new Set();
  const orders = new Set();

  for (let index = 0; index < sections.length; index++) {
    const sectionData = pickSectionFields(sections[index] || {});

    const validationErrors = validateSectionData(sectionData, true);

    if (validationErrors.length) {
      return {
        errors: validationErrors.map(
          (message) => `Section ${index + 1}: ${message}`
        ),
        sections: [],
      };
    }

    if (sectionIds.has(sectionData.sectionId)) {
      return {
        errors: [
          `Duplicate sectionId: ${sectionData.sectionId}`,
        ],
        sections: [],
      };
    }

    sectionIds.add(sectionData.sectionId);

    if (orders.has(sectionData.order)) {
      return {
        errors: [
          `Duplicate section order: ${sectionData.order}`,
        ],
        sections: [],
      };
    }

    orders.add(sectionData.order);
    validatedSections.push(sectionData);
  }

  return {
    errors: [],
    sections: validatedSections,
  };
};

// ==========================================
// ADD SECTION
// POST /api/v1/test/mocktest/:id/section
// ==========================================
exports.addSection = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    const sectionData = pickSectionFields(req.body || {});

    // Use the ID provided by the frontend when supplied.
    const validationErrors = validateSectionData(sectionData, true);

    if (validationErrors.length) {
      return error(
        res,
        null,
        "Section validation failed.",
        400,
        validationErrors
      );
    }

    const duplicate = mockTest.sections.some(
      (section) => section.sectionId === sectionData.sectionId
    );

    if (duplicate) {
      return error(
        res,
        null,
        "A section with this sectionId already exists.",
        409
      );
    }

    mockTest.sections.push(sectionData);

    setUpdatedBy(mockTest, req);
    await mockTest.save();

    const addedSection = mockTest.sections.find(
      (section) => section.sectionId === sectionData.sectionId
    );

    return success(
      res,
      addedSection,
      "Section added successfully.",
      201
    );
  } catch (err) {
    return handleError(res, err);
  }
};

// ==========================================
// UPDATE ONE SECTION
// PATCH /api/v1/test/mocktest/:id/section/:sectionId
// ==========================================
exports.updateSection = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    const section = mockTest.sections.find(
      (item) => item.sectionId === req.params.sectionId
    );

    if (!section) {
      return error(res, null, "Section not found.", 404);
    }

    const updates = pickSectionFields(req.body || {});

    if (Object.keys(updates).length === 0) {
      return error(
        res,
        null,
        "No section fields were provided.",
        400
      );
    }

    const validationErrors = validateSectionData(updates);

    if (validationErrors.length) {
      return error(
        res,
        null,
        "Section validation failed.",
        400,
        validationErrors
      );
    }

    if (
      updates.sectionId !== undefined &&
      updates.sectionId !== section.sectionId
    ) {
      const duplicate = mockTest.sections.some(
        (item) => item.sectionId === updates.sectionId
      );

      if (duplicate) {
        return error(
          res,
          null,
          "A section with this sectionId already exists.",
          409
        );
      }
    }

    section.set(updates);

    setUpdatedBy(mockTest, req);
    await mockTest.save();

    return success(
      res,
      section,
      "Section updated successfully."
    );
  } catch (err) {
    return handleError(res, err);
  }
};

// ==========================================
// UPDATE ALL SECTIONS
// PATCH /api/v1/test/mocktest/:id/sections
//
// Saves every section sent in req.body.sections.
// The submitted array becomes the complete section list.
// ==========================================
exports.updateSections = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    console.log(req.body)

    if (
      !req.body ||
      !Object.prototype.hasOwnProperty.call(req.body, "sections")
    ) {
      return error(
        res,
        null,
        "Please provide the sections array.",
        400
      );
    }

    const { errors, sections } = validateSectionsArray(
      req.body.sections
    );

    if (errors.length) {
      return error(
        res,
        null,
        "Section validation failed.",
        400,
        errors
      );
    }

    const existingSections = mockTest.sections || [];

    // Preserve existing subdocument _id values when the sectionId
    // matches. New sections receive new MongoDB subdocument IDs.
    const savedSections = sections.map((sectionData) => {
      const existingSection = existingSections.find(
        (item) => item.sectionId === sectionData.sectionId
      );

      return {
        ...(existingSection?._id
          ? { _id: existingSection._id }
          : {}),
        ...sectionData,
      };
    });

    // Replacing the array also removes sections omitted by the client.
    mockTest.sections = savedSections;

    setUpdatedBy(mockTest, req);
    await mockTest.save();

    return success(
      res,
      mockTest.sections,
      "All sections saved successfully."
    );
  } catch (err) {
    return handleError(res, err);
  }
};

// ==========================================
// DELETE ONE SECTION
// DELETE /api/v1/test/mocktest/:id/section/:sectionId
// ==========================================
exports.deleteSection = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    const sectionIndex = mockTest.sections.findIndex(
      (section) => section.sectionId === req.params.sectionId
    );

    if (sectionIndex === -1) {
      return error(res, null, "Section not found.", 404);
    }

    mockTest.sections.splice(sectionIndex, 1);

    setUpdatedBy(mockTest, req);
    await mockTest.save();

    return success(
      res,
      null,
      "Section deleted successfully."
    );
  } catch (err) {
    return handleError(res, err);
  }
};
