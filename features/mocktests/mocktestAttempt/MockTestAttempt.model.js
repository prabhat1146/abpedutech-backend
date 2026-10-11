
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
      ],
      default: "InProgress",
    },

    answers: {
      type: [answerSchema],
      default: [],
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

// Fetch attempts for a student's test history.
mockTestAttemptSchema.index({
  student: 1,
  mockTest: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "MockTestAttempt",
  mockTestAttemptSchema
);
