const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    // Universal Question ID
    questionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // ==========================
    // English
    // ==========================
    questionLang: {
      eng: {
        question: {
          type: String,
          required: true,
          trim: true,
        },

        options: [
          {
            optionId: {
              type: String,
              required: true,
              trim: true,
            },

            text: {
              type: String,
              required: true,
              trim: true,
            },

            image: {
              type: String,
              default: "",
            },
          },
        ],

        explanation: {
          type: String,
          default: "",
        },

        hint: {
          type: String,
          default: "",
        },
      },

      // ==========================
      // Hindi
      // ==========================
      hindi: {
        question: {
          type: String,
          trim: true,
          default: "",
        },

        options: [
          {
            optionId: {
              type: String,
              required: true,
              trim: true,
            },

            text: {
              type: String,
              required: true,
              trim: true,
            },

            image: {
              type: String,
              default: "",
            },
          },
        ],

        explanation: {
          type: String,
          default: "",
        },

        hint: {
          type: String,
          default: "",
        },
      },
    },

    // Question Type
    questionType: {
      type: String,
      enum: [
        "mcq",
        "msq",
        "numerical",
        "subjective",
        "true_false",
        "assertion_reason",
      ],
      required: true,
    },

    // Correct Option IDs
    correctAnswers: [
      {
        type: String,
        required: true,
      },
    ],

    // Difficulty
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    // Source
    source: {
      type: {
        type: String,
        enum: ["original", "pyq", "imported", "ai"],
        default: "original",
      },

      examId: String,

      year: Number,

      shift: Number,

      paper: Number,

      questionNumber: Number,
    },

    // Academic

    // Academic
    academic: {
      subject: {
        id: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
      },

      chapter: {
        id: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
      },

      topic: {
        id: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
      },

      subTopic: {
        id: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
      },
    },

    // Search
    tags: [String],

    keywords: [String],

    // Status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    // Analytics
    analytics: {
      totalAttempts: {
        type: Number,
        default: 0,
      },

      correctAttempts: {
        type: Number,
        default: 0,
      },

      wrongAttempts: {
        type: Number,
        default: 0,
      },

      skippedAttempts: {
        type: Number,
        default: 0,
      },

      averageTime: {
        type: Number,
        default: 0,
      },
    },

    // Attachments
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "audio", "video", "pdf"],
        },

        url: String,

        caption: String,
      },
    ],

    // Version
    version: {
      type: Number,
      default: 1,
    },

    parentQuestionId: {
      type: String,
      default: null,
    },

    // Audit
    createdBy: {
      type: String,
      required: true,
    },

    updatedBy: String,

    approvedBy: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Question", QuestionSchema);
