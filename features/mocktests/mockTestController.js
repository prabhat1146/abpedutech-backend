const mongoose = require("mongoose");
const MockTest = require("./mocktest.model");
const { success, error } = require("../../utility/response");

// Fields admins can update through this controller.
const editableFields = [
  "title",
  "slug",
  "description",
  "instructions",
  "language",
  "attemptDuration",
  "totalMarks",
  "passingMarks",
  "marksPerQuestion",
  "negativeMarking",
  "negativeMarksPerQuestion",
  "availabilityStartTime",
  "availabilityEndTime",
  "lastAttemptStartTime",
  "allowAttemptCompletionAfterEnd",
  "shuffleQuestions",
  "shuffleOptions",
  "allowReview",
  "allowPause",
  "showResultImmediately",
  "maxAttempts",
  "visibility",
  "status",
  "isFeatured",
  "accessCode",
];

const LANGUAGES = ["English", "Hindi", "Both"];
const VISIBILITIES = ["Public", "Private"];
const STATUSES = ["Draft", "Published", "Inactive", "Archived"];

const isValidId = (id) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  new mongoose.Types.ObjectId(id).toString() === id.toLowerCase();

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const pickEditableFields = (body = {}) => {
  const result = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
};

// Centralized error handler using the response utility.
const sendError = (res, err) => {
  console.error("MockTest controller error:", err);

  if (
    err.name === "ValidationError" ||
    err.name === "StrictModeError"
  ) {
    return error(res, null, err.message, 400);
  }

  if (err.name === "CastError") {
    return error(res, null, `Invalid value for ${err.path}.`, 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];

    return error(
      res,
      null,
      `A mock test with this ${field || "unique field"} already exists.`,
      409
    );
  }

  return error(res, null, "Internal server error.", 500);
};

// Find by MongoDB _id or custom mock test ID.
const findMockTest = (identifier) => {
  if (typeof identifier !== "string" || !identifier.trim()) {
    return MockTest.findOne({ _id: null });
  }

  const value = identifier.trim();

  return MockTest.findOne(
    isValidId(value) ? { _id: value } : { id: value }
  );
};

const validateNumber = (
  value,
  field,
  { min = 0, integer = false } = {}
) => {
  if (
    value === null ||
    value === "" ||
    typeof value === "boolean"
  ) {
    return `${field} must be a valid number.`;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < min ||
    (integer && !Number.isInteger(number))
  ) {
    return `${field} must be ${
      integer ? "an integer" : "a number"
    } greater than or equal to ${min}.`;
  }

  return null;
};

const validateDate = (value, field, nullable = false) => {
  if (value === null && nullable) return null;

  if (value === null || value === "" || value === undefined) {
    return `${field} must be a valid date.`;
  }

  if (Number.isNaN(new Date(value).getTime())) {
    return `${field} must be a valid date.`;
  }

  return null;
};

const validateAndNormalize = (data, creating = false) => {
  const errors = [];

  if (creating || data.title !== undefined) {
    if (typeof data.title !== "string" || !data.title.trim()) {
      errors.push("Mock test title is required.");
    } else {
      data.title = data.title.trim();
    }
  }

  if (data.slug !== undefined) {
    if (typeof data.slug !== "string" || !data.slug.trim()) {
      errors.push("Slug cannot be empty.");
    } else {
      data.slug = slugify(data.slug);

      if (!data.slug) {
        errors.push("Please provide a valid slug.");
      }
    }
  }

  for (const field of ["description", "instructions"]) {
    if (
      data[field] !== undefined &&
      data[field] !== null &&
      typeof data[field] !== "string"
    ) {
      errors.push(`${field} must be a string.`);
    } else if (typeof data[field] === "string") {
      data[field] = data[field].trim();
    }
  }

  if (
    data.language !== undefined &&
    !LANGUAGES.includes(data.language)
  ) {
    errors.push(`Language must be one of: ${LANGUAGES.join(", ")}.`);
  }

  if (
    data.visibility !== undefined &&
    !VISIBILITIES.includes(data.visibility)
  ) {
    errors.push(
      `Visibility must be one of: ${VISIBILITIES.join(", ")}.`
    );
  }

  if (
    data.status !== undefined &&
    !STATUSES.includes(data.status)
  ) {
    errors.push(`Status must be one of: ${STATUSES.join(", ")}.`);
  }

  const numericFields = [
    ["attemptDuration", 1, true],
    ["passingMarks", 0, false],
    ["marksPerQuestion", 0, false],
    ["negativeMarksPerQuestion", 0, false],
    ["maxAttempts", 1, true],
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

  const booleanFields = [
    "negativeMarking",
    "allowAttemptCompletionAfterEnd",
    "shuffleQuestions",
    "shuffleOptions",
    "allowReview",
    "allowPause",
    "showResultImmediately",
    "isFeatured",
  ];

  for (const field of booleanFields) {
    if (
      data[field] !== undefined &&
      typeof data[field] !== "boolean"
    ) {
      errors.push(`${field} must be true or false.`);
    }
  }

  for (const field of [
    "availabilityStartTime",
    "availabilityEndTime",
    "lastAttemptStartTime",
  ]) {
    if (data[field] !== undefined) {
      const validationError = validateDate(
        data[field],
        field,
        field === "lastAttemptStartTime"
      );

      if (validationError) {
        errors.push(validationError);
      } else if (data[field] !== null) {
        data[field] = new Date(data[field]);
      }
    }
  }

  if (creating) {
    if (!data.availabilityStartTime) {
      errors.push("Availability start time is required.");
    }

    if (!data.availabilityEndTime) {
      errors.push("Availability end time is required.");
    }

    if (data.attemptDuration === undefined) {
      errors.push("Attempt duration is required.");
    }
  }

  return errors;
};

const validateAvailability = (mockTest) => {
  const start = mockTest.availabilityStartTime
    ? new Date(mockTest.availabilityStartTime)
    : null;

  const end = mockTest.availabilityEndTime
    ? new Date(mockTest.availabilityEndTime)
    : null;

  const latest = mockTest.lastAttemptStartTime
    ? new Date(mockTest.lastAttemptStartTime)
    : null;

  if (!start || Number.isNaN(start.getTime())) {
    return "A valid availability start time is required.";
  }

  if (!end || Number.isNaN(end.getTime())) {
    return "A valid availability end time is required.";
  }

  if (end < start) {
    return "Availability end time must be after start time.";
  }

  if (latest && latest < start) {
    return "Latest attempt start time cannot be before availability starts.";
  }

  if (latest && latest > end) {
    return "Latest attempt start time cannot be after availability ends.";
  }

  return null;
};

const setUpdatedBy = (mockTest, req) => {
  const userId = req.user?._id || req.user?.id;

  if (userId && isValidId(String(userId))) {
    mockTest.updatedBy = userId;
  }
};

// ==========================================
// CREATE MOCK TEST
// POST /api/mock-tests
// ==========================================
exports.createMockTest = async (req, res) => {
  try {
    const data = pickEditableFields(req.body);

    const requestedTotalMarks = req.body.totalMarks;
    const requestedPassingMarks = req.body.passingMarks;

    const validationErrors = validateAndNormalize(data, true);

    if (validationErrors.length) {
      return error(
        res,
        null,
        validationErrors.join(" "),
        400
      );
    }

    if (data.slug === undefined) {
      data.slug = slugify(data.title);
    }

    if (!data.slug) {
      return error(
        res,
        null,
        "A valid title or slug is required.",
        400
      );
    }

    if (requestedTotalMarks !== undefined) {
      data.totalMarks = requestedTotalMarks;
    }

    if (requestedPassingMarks !== undefined) {
      data.passingMarks = requestedPassingMarks;
    }

    const availabilityError = validateAvailability(data);

    if (availabilityError) {
      return error(res, null, availabilityError, 400);
    }

    // Find existing IDs and determine the highest numeric suffix.
    // This avoids depending on lexicographical sorting.
    const existingIds = await MockTest.find({
      id: { $regex: /^MOCKTEST\d+$/ },
    })
      .select("id")
      .lean();

    const lastNumber = existingIds.reduce((max, item) => {
      const number = Number(item.id.slice("MOCKTEST".length));

      return Number.isSafeInteger(number) && number > max
        ? number
        : max;
    }, 0);

    data.id = `MOCKTEST${String(lastNumber + 1).padStart(5, "0")}`;

    // New mock tests always start as drafts.
    data.status = "Draft";
    data.sections = [];
    data.totalQuestions = 0;
    data.totalAttempts = 0;
    data.totalCompletions = 0;

    const userId = req.user?._id || req.user?.id;

    if (userId && isValidId(String(userId))) {
      data.createdBy = userId;
      data.updatedBy = userId;
    }

    const mockTest = new MockTest(data);

    await mockTest.save();

    return success(
      res,
      mockTest,
      "Mock test created successfully. Add sections next.",
      201
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// GET ALL MOCK TESTS
// GET /api/mock-tests
// ==========================================
exports.getAllMockTests = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Math.floor(Number(req.query.page) || 1)
    );

    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(req.query.limit) || 10))
    );

    const filter = {};

    if (req.query.status !== undefined) {
      if (!STATUSES.includes(req.query.status)) {
        return error(res, null, "Invalid status filter.", 400);
      }

      filter.status = req.query.status;
    }

    if (req.query.visibility !== undefined) {
      if (!VISIBILITIES.includes(req.query.visibility)) {
        return error(res, null, "Invalid visibility filter.", 400);
      }

      filter.visibility = req.query.visibility;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();

      if (search) {
        const escaped = search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        filter.$or = [
          { title: { $regex: escaped, $options: "i" } },
          { id: { $regex: escaped, $options: "i" } },
          { slug: { $regex: escaped, $options: "i" } },
        ];
      }
    }

    const [mockTests, total] = await Promise.all([
      MockTest.find(filter)
        .select("-accessCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      MockTest.countDocuments(filter),
    ]);

    return success(
      res,
      mockTests,
      "Mock tests retrieved successfully.",
      200,
      {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// GET SINGLE MOCK TEST
// GET /api/mock-tests/:id
// ==========================================
exports.getMockTestById = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id)
      .populate("sections.questions")
      .select("-accessCode");

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    return success(
      res,
      mockTest,
      "Mock test retrieved successfully.",
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// UPDATE MOCK TEST DETAILS
// PATCH /api/mock-tests/:id
// ==========================================
exports.updateMockTest = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    const updates = pickEditableFields(req.body);

    if (Object.keys(updates).length === 0) {
      return error(
        res,
        null,
        "No editable fields were provided.",
        400
      );
    }

    const validationErrors = validateAndNormalize(updates);

    if (validationErrors.length) {
      return error(
        res,
        null,
        validationErrors.join(" "),
        400
      );
    }

    if (
      updates.title !== undefined &&
      updates.slug === undefined
    ) {
      updates.slug = slugify(updates.title);
    }

    const finalState = {
      availabilityStartTime:
        updates.availabilityStartTime !== undefined
          ? updates.availabilityStartTime
          : mockTest.availabilityStartTime,

      availabilityEndTime:
        updates.availabilityEndTime !== undefined
          ? updates.availabilityEndTime
          : mockTest.availabilityEndTime,

      lastAttemptStartTime:
        updates.lastAttemptStartTime !== undefined
          ? updates.lastAttemptStartTime
          : mockTest.lastAttemptStartTime,
    };

    const availabilityError = validateAvailability(finalState);

    if (availabilityError) {
      return error(res, null, availabilityError, 400);
    }

    const finalTotalMarks =
      updates.totalMarks !== undefined
        ? Number(updates.totalMarks)
        : Number(mockTest.totalMarks || 0);

    if (
      updates.passingMarks !== undefined &&
      updates.passingMarks > finalTotalMarks
    ) {
      return error(
        res,
        null,
        `Passing marks cannot exceed the current total marks (${finalTotalMarks}).`,
        400
      );
    }

    for (const [key, value] of Object.entries(updates)) {
      mockTest.set(key, value);
    }

    setUpdatedBy(mockTest, req);

    await mockTest.save();

    return success(
      res,
      mockTest,
      "Mock test updated successfully.",
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// PUBLISH MOCK TEST
// PATCH /api/mock-tests/:id/publish
// ==========================================
exports.publishMockTest = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    if (!mockTest.sections || mockTest.sections.length === 0) {
      return error(
        res,
        null,
        "Add at least one section before publishing.",
        400
      );
    }

    if (Number(mockTest.totalQuestions || 0) < 1) {
      return error(
        res,
        null,
        "Add at least one question before publishing.",
        400
      );
    }

    if (
      Number(mockTest.passingMarks || 0) >
      Number(mockTest.totalMarks || 0)
    ) {
      return error(
        res,
        null,
        "Passing marks cannot exceed total marks.",
        400
      );
    }

    const availabilityError = validateAvailability(mockTest);

    if (availabilityError) {
      return error(res, null, availabilityError, 400);
    }

    mockTest.status = "Published";
    setUpdatedBy(mockTest, req);

    await mockTest.save();

    return success(
      res,
      mockTest,
      "Mock test published successfully.",
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// DEACTIVATE MOCK TEST
// PATCH /api/mock-tests/:id/deactivate
// ==========================================
exports.deactivateMockTest = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    mockTest.status = "Inactive";
    setUpdatedBy(mockTest, req);

    await mockTest.save();

    return success(
      res,
      mockTest,
      "Mock test deactivated successfully.",
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// DELETE MOCK TEST
// DELETE /api/mock-tests/:id
// ==========================================
exports.deleteMockTest = async (req, res) => {
  try {
    const mockTest = await findMockTest(req.params.id);

    if (!mockTest) {
      return error(res, null, "Mock test not found.", 404);
    }

    await mockTest.deleteOne();

    return success(
      res,
      null,
      "Mock test deleted successfully.",
      200
    );
  } catch (err) {
    return sendError(res, err);
  }
};

// ==========================================
// GET ALL PUBLISHED MOCK TESTS FOR USERS
// ==========================================
exports.getAllMockTestsForUser = async (req, res) => {
  try {
    const page = Math.max(
      1,
      Math.floor(Number(req.query.page) || 1)
    );

    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(req.query.limit) || 10))
    );

    const filter = {
      status: "Published",
    };

    if (req.query.search) {
      const search = String(req.query.search).trim();

      if (search) {
        const escaped = search.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        filter.$or = [
          { title: { $regex: escaped, $options: "i" } },
          { id: { $regex: escaped, $options: "i" } },
          { slug: { $regex: escaped, $options: "i" } },
        ];
      }
    }

    const [mockTests, total] = await Promise.all([
      MockTest.find(filter)
        .select("-accessCode")
        .populate("sections.questions")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      MockTest.countDocuments(filter),
    ]);

    return success(
      res,
      mockTests,
      "Mock tests retrieved successfully.",
      200,
      {
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      }
    );
  } catch (err) {
    return sendError(res, err);
  }
};