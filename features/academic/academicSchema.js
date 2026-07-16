const mongoose = require("mongoose");

const academicSchema = new mongoose.Schema(
  {
    subject: {
      id: {
        type: String,
        required: true,
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
      },
      name: {
        type: String,
        trim: true,
      },
    },

    topic: {
      id: {
        type: String,
      },
      name: {
        type: String,
        trim: true,
      },
    },

    subtopic: {
      id: {
        type: String,
      },
      name: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

academicSchema.index({ "subject.id": 1 }, { unique: true });
academicSchema.index({ "chapter.id": 1 }, { unique: true, sparse: true });
academicSchema.index({ "topic.id": 1 }, { unique: true, sparse: true });
academicSchema.index({ "subtopic.id": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("AcademicStructure", academicSchema);