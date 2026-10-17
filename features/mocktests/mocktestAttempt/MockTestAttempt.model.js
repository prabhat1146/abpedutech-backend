
const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },

    selectedOption: {
      type: String,
      default: "",
      trim: true,
    },

    isMarkedForReview: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const mockTestAttemptSchema = new mongoose.Schema(
  {
    mockTest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "InProgress",
        "Submitted",
        "Expired",
        "Evaluated",
        "NotStarted",
      ],
      default: "NotStarted",
    },

    answers: {
      type: [answerSchema],
      default: [],
    },

    // Marks awarded for each correct answer
    positiveMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    // Marks deducted for each incorrect answer
    negativeMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    obtainedMarks: {
      type: Number,
      default: 0,
    },

    isPassed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate attempt numbers for the same student and test.
mockTestAttemptSchema.index(
  {
    mockTest: 1,
    student: 1,
    attemptNumber: 1,
  },
  {
    unique: true,
  }
);

// Fetch a student's attempts for a specific mock test.
mockTestAttemptSchema.index({
  student: 1,
  mockTest: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "MockTestAttempt",
  mockTestAttemptSchema
);
