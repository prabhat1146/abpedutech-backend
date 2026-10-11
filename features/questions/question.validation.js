const Joi = require("joi");

const optionSchema = Joi.object({
  optionId: Joi.string().trim().allow("").default(""),
  text: Joi.string().trim().required(),
  image: Joi.string().allow("").default(""),
});

const validateOptions = () => {
  return Joi.array()
    .items(optionSchema)
    .custom((value, helpers) => {
      const { questionType } = helpers.state.ancestors[0];

      if (
        ["mcq", "msq", "true_false", "assertion_reason"].includes(
          questionType
        )
      ) {
        if (value.length !== 4 && value.length !== 5) {
          return helpers.error("options.invalidCount");
        }
      }

      if (["numerical", "subjective"].includes(questionType)) {
        if (value.length > 0) {
          return helpers.error("options.notAllowed");
        }
      }

      return value;
    })
    .messages({
      "options.invalidCount":
        "This question type must have exactly 4 or 5 options.",
      "options.notAllowed":
        "Numerical and Subjective questions must not contain options.",
    });
};

const academicSchema = Joi.object({
  subject: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
  }).required(),

  chapter: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
  }).required(),

  topic: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
  }).required(),

  subTopic: Joi.object({
    id: Joi.string().trim().required(),
    name: Joi.string().trim().required(),
  }).required(),
}).required();

const askedBySchema = Joi.object({
  organisation: Joi.object({
    id: Joi.string().trim().allow("").default(""),
    name: Joi.string().trim().allow("").default(""),
  }).default({}),

  examName: Joi.object({
    id: Joi.string().trim().allow("").default(""),
    name: Joi.string().trim().allow("").default(""),
  }).default({}),

  paper: Joi.object({
    id: Joi.string().valid("1", "2").allow("").default(""),
    name: Joi.string().valid("first", "second").allow("").default(""),
  }).default({}),

  shift: Joi.object({
    id: Joi.string().valid("1", "2", "3").default("1"),
    name: Joi.string().valid("first", "second", "third").default("first"),
  }).default({}),

  year: Joi.number()
    .integer()
    .min(1900)
    .max(9999)
    .allow(null)
    .default(null),
});

const questionValidation = Joi.object({
  questionId: Joi.string().trim().required(),

  questionLang: Joi.object({
    eng: Joi.object({
      question: Joi.string().trim().required(),
      options: validateOptions().required(),
      explanation: Joi.string().allow("").default(""),
      hint: Joi.string().allow("").default(""),
    }).required(),

    hindi: Joi.object({
      question: Joi.string().trim().allow("").default(""),
      options: Joi.array()
        .items(optionSchema)
        .default([]),
      explanation: Joi.string().allow("").default(""),
      hint: Joi.string().allow("").default(""),
    }).default({}),
  }).required(),

  questionType: Joi.string()
    .valid(
      "mcq",
      "msq",
      "numerical",
      "subjective",
      "true_false",
      "assertion_reason"
    )
    .required(),

  correctAnswers: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  difficulty: Joi.string()
    .valid("easy", "medium", "hard")
    .default("medium"),

  academic: academicSchema,

  askedBy: Joi.array()
    .items(askedBySchema)
    .default([]),

  tags: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  keywords: Joi.array()
    .items(Joi.string().trim())
    .default([]),

  status: Joi.string()
    .valid("draft", "published", "archived")
    .default("draft"),

  visibility: Joi.string()
    .valid("public", "private")
    .default("public"),

  analytics: Joi.object({
    totalAttempts: Joi.number().default(0),
    correctAttempts: Joi.number().default(0),
    wrongAttempts: Joi.number().default(0),
    skippedAttempts: Joi.number().default(0),
    averageTime: Joi.number().default(0),
  }).default({}),

  attachments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("image", "audio", "video", "pdf")
          .required(),

        url: Joi.string().allow("").required(),

        caption: Joi.string().allow("").default(""),
      })
    )
    .default([]),

  version: Joi.number().default(1),

  createdBy: Joi.string().allow(""),

  updatedBy: Joi.string().allow(""),

  approvedBy: Joi.string().allow(""),
});

module.exports = questionValidation;