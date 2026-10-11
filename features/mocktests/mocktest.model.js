
const mongoose = require("mongoose");

const { Schema } = mongoose;

// ==========================================
// SECTION SCHEMA
// ==========================================
const sectionSchema = new Schema(
  {
    sectionId: {
      type: String,
      required: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    instructions: {
      type: String,
      default: "",
      trim: true,
    },

    // Questions assigned to this section
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    marksPerQuestion: {
      type: Number,
      default: 1,
      min: 0,
    },

    negativeMarking: {
      type: Boolean,
      default: false,
    },

    negativeMarksPerQuestion: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Section timer in minutes; 0 uses the overall timer
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    isOptional: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { _id: true }
);

// ==========================================
// MOCK TEST SCHEMA
// ==========================================
const mockTestSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    instructions: {
      type: String,
      default: "",
      trim: true,
    },

    language: {
      type: String,
      enum: ["English", "Hindi", "Both"],
      default: "Both",
    },

    // ======================================
    // SECTIONS
    // ======================================
    sections: {
      type: [sectionSchema],
      default: [],
    },

    // ======================================
    // AUTOMATICALLY CALCULATED TOTALS
    // Do not rely on client-supplied totals
    // ======================================
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Overall test duration in minutes
    attemptDuration: {
      type: Number,
      required: true,
      min: 1,
    },

    passingMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Retained for compatibility with existing API
    marksPerQuestion: {
      type: Number,
      default: 1,
      min: 0,
    },

    negativeMarking: {
      type: Boolean,
      default: false,
    },

    negativeMarksPerQuestion: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================
    // AVAILABILITY
    // ======================================
    availabilityStartTime: {
      type: Date,
      required: true,
    },

    availabilityEndTime: {
      type: Date,
      required: true,
    },

    // Null means use availabilityEndTime as the limit
    lastAttemptStartTime: {
      type: Date,
      default: null,
    },

    allowAttemptCompletionAfterEnd: {
      type: Boolean,
      default: true,
    },

    // ======================================
    // TEST BEHAVIOR
    // ======================================
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },

    shuffleOptions: {
      type: Boolean,
      default: false,
    },

    allowReview: {
      type: Boolean,
      default: true,
    },

    allowPause: {
      type: Boolean,
      default: false,
    },

    showResultImmediately: {
      type: Boolean,
      default: true,
    },

    maxAttempts: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ======================================
    // PUBLICATION AND VISIBILITY
    // ======================================
    status: {
      type: String,
      enum: ["Draft", "Published", "Inactive", "Archived"],
      default: "Draft",
    },

    visibility: {
      type: String,
      enum: ["Public", "Private"],
      default: "Public",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Optional private-test password
    // Excluded from query results by default
    accessCode: {
      type: String,
      select: false,
      default: undefined,
    },

    // ======================================
    // STATISTICS
    // ======================================
    totalAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCompletions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================
    // AUDIT INFORMATION
    // ======================================
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// VALIDATION AND AUTOMATIC TOTAL CALCULATION
// ==========================================

mockTestSchema.pre("validate", function () {
  // Skip calculations when no sections exist
  if (!Array.isArray(this.sections) || this.sections.length === 0) {
    return;
  }

  for (const section of this.sections) {
    const questionCount = Array.isArray(section.questions)
      ? section.questions.length
      : 0;

    // Update section-level data only
    section.totalQuestions = questionCount;

    section.totalMarks =
      questionCount * (Number(section.marksPerQuestion) || 0);
  }

  // Do not update global totalQuestions or totalMarks
});

// ==========================================
// INDEXES
// ==========================================
mockTestSchema.index({
  status: 1,
  availabilityStartTime: 1,
});

mockTestSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model("MockTest", mockTestSchema);
