
const mongoose = require("mongoose");
const MockTest = require("./mocktest.model");

// Fields admins can update through this controller.
// Sections and calculated totals are managed separately.

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

const sendError = (res, error) => {
  console.error("MockTest controller error:", error);

  if (
    error.name === "ValidationError" ||
    error.name === "StrictModeError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${error.path}.`,
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];

    return res.status(409).json({
      success: false,
      message: `A mock test with this ${field || "unique field"} already exists.`,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

// Find by MongoDB _id or custom mock test id.
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

      if (!data.slug) errors.push("Please provide a valid slug.");
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
      const error = validateNumber(data[field], field, {
        min,
        integer,
      });

      if (error) {
        errors.push(error);
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
      const error = validateDate(
        data[field],
        field,
        field === "lastAttemptStartTime"
      );

      if (error) {
        errors.push(error);
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

    // Preserve requested marks
    const requestedTotalMarks = req.body.totalMarks;
    const requestedPassingMarks = req.body.passingMarks;

    // Validate input
    const errors = validateAndNormalize(data, true);

    if (errors.length) {
      return error(res, null, errors.join(" "), 400);
    }

    // Generate slug
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

    // Preserve marks provided by the client
    if (requestedTotalMarks !== undefined) {
      data.totalMarks = requestedTotalMarks;
    }

    if (requestedPassingMarks !== undefined) {
      data.passingMarks = requestedPassingMarks;
    }

    // Validate availability dates
    const availabilityError = validateAvailability(data);

    if (availabilityError) {
      return error(res, null, availabilityError, 400);
    }

    // Find the latest existing sequential mock test ID
    const lastMockTest = await MockTest.findOne({
      id: { $regex: /^MOCKTEST\d+$/ },
    })
      .sort({ id: -1 })
      .select("id")
      .lean();

    // Calculate the next ID
    const lastNumber = lastMockTest
      ? parseInt(lastMockTest.id.replace("MOCKTEST", ""), 10)
      : 0;

    data.id = `MOCKTEST${String(lastNumber + 1).padStart(5, "0")}`;

    // Every new mock test starts as a draft
    data.status = "Draft";
    data.sections = [];
    data.totalQuestions = 0;
    data.totalAttempts = 0;
    data.totalCompletions = 0;

    // Set creator and updater
    const userId = req.user?._id || req.user?.id;

    if (userId && isValidId(String(userId))) {
      data.createdBy = userId;
      data.updatedBy = userId;
    }

    // Create and save mock test
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
        return res.status(400).json({
          success: false,
          message: "Invalid status filter.",
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.visibility !== undefined) {
      if (!VISIBILITIES.includes(req.query.visibility)) {
        return res.status(400).json({
          success: false,
          message: "Invalid visibility filter.",
        });
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

    return res.status(200).json({
      success: true,
      data: mockTests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
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
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: mockTest,
    });
  } catch (error) {
    return sendError(res, error);
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
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const updates = pickEditableFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No editable fields were provided.",
      });
    }

    const errors = validateAndNormalize(updates);

    if (errors.length) {
      return res.status(400).json({
        success: false,
        message: errors.join(" "),
      });
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
      return res.status(400).json({
        success: false,
        message: availabilityError,
      });
    }

    mockTest.totalMarks=updates.totalMarks;
    // console.log(updates)

    if (updates.passingMarks !== undefined) {
      const totalMarks = Number(mockTest.totalMarks || 0);

      if (updates.passingMarks > totalMarks) {
        return res.status(400).json({
          success: false,
          message: `Passing marks cannot exceed the current total marks (${totalMarks}).`,
        });
      }
    }

    for (const [key, value] of Object.entries(updates)) {
      mockTest.set(key, value);
    }

    setUpdatedBy(mockTest, req);
    await mockTest.save();

    return res.status(200).json({
      success: true,
      message: "Mock test updated successfully.",
      data: mockTest,
    });
  } catch (error) {
    return sendError(res, error);
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
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    if (!mockTest.sections || mockTest.sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one section before publishing.",
      });
    }

    if (Number(mockTest.totalQuestions || 0) < 1) {
      return res.status(400).json({
        success: false,
        message: "Add at least one question before publishing.",
      });
    }

    if (
      Number(mockTest.passingMarks || 0) >
      Number(mockTest.totalMarks || 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Passing marks cannot exceed total marks.",
      });
    }

    const availabilityError = validateAvailability(mockTest);

    if (availabilityError) {
      return res.status(400).json({
        success: false,
        message: availabilityError,
      });
    }

    mockTest.status = "Published";
    setUpdatedBy(mockTest, req);

    await mockTest.save();

    return res.status(200).json({
      success: true,
      message: "Mock test published successfully.",
      data: mockTest,
    });
  } catch (error) {
    return sendError(res, error);
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
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    mockTest.status = "Inactive";
    setUpdatedBy(mockTest, req);

    await mockTest.save();

    return res.status(200).json({
      success: true,
      message: "Mock test deactivated successfully.",
      data: mockTest,
    });
  } catch (error) {
    return sendError(res, error);
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
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    await mockTest.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Mock test deleted successfully.",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// user
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

    // Only published mock tests for users
    const filter = {
      status: "Published",
    };

    // Search by title, ID, or slug
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

    return res.status(200).json({
      success: true,
      data: mockTests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};