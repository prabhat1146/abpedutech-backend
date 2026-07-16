const Joi = require("joi");

const optionSchema = Joi.object({
    optionId: Joi.string().allow("").optional(),

    text: Joi.string().trim().required(),

    image: Joi.string().allow("").default("")
});

const validateOptions = () => {

    return Joi.array()
        .items(optionSchema)
        .custom((value, helpers) => {

            const { questionType } = helpers.state.ancestors[0];

            // MCQ, MSQ, True/False, Assertion & Reason
            if (["mcq", "msq", "true_false", "assertion_reason"].includes(questionType)) {

                if (value.length !== 4 && value.length !== 5) {
                    return helpers.error("options.invalidCount");
                }

            }

            // Numerical & Subjective
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
                "Numerical and Subjective questions must not contain options."
        });

};


const academicSchema = Joi.object({
  subject: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().trim().required(),
  }).required(),

  chapter: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().trim().required(),
  }).required(),

  topic: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().trim().required(),
  }).required(),

  subTopic: Joi.object({
    id: Joi.string().required(),
    name: Joi.string().trim().required(),
  }).required(),
});

const questionValidation = Joi.object({

  questionId: Joi.string().allow("").optional(),

  questionLang: Joi.object({

    eng: Joi.object({

      question: Joi.string().trim().required(),

      options: validateOptions(),

      explanation: Joi.string().allow("").default(""),

      hint: Joi.string().allow("").default("")

    }).required(),

    hindi: Joi.object({

      question: Joi.string().allow("").default(""),

      options: Joi.array()
        .items(optionSchema)
        .default([]),

      explanation: Joi.string().allow("").default(""),

      hint: Joi.string().allow("").default("")

    }).default({})

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
    .items(Joi.string())
    .min(1)
    .required(),

  difficulty: Joi.string()
    .valid("easy", "medium", "hard")
    .default("medium"),

  source: Joi.object({

    type: Joi.string()
      .valid("original", "pyq", "imported", "ai")
      .default("original"),

    examId: Joi.string().allow(""),

    year: Joi.number(),

    shift: Joi.number(),

    paper: Joi.number(),

    questionNumber: Joi.number()

  }).default(),

  academic: academicSchema.required(),

  tags: Joi.array()
    .items(Joi.string())
    .default([]),

  keywords: Joi.array()
    .items(Joi.string())
    .default([]),

  status: Joi.string()
    .valid("draft", "published", "archived")
    .default("draft"),

  visibility: Joi.string()
    .valid("public", "private")
    .default("public"),

  attachments: Joi.array().items(

    Joi.object({

      type: Joi.string()
        .valid("image", "audio", "video", "pdf")
        .required(),

      url: Joi.string().required(),

      caption: Joi.string().allow("")

    })

  ).default([]),

  version: Joi.number().default(1),

  parentQuestionId: Joi.string()
    .allow(null, ""),

  createdBy: Joi.string().required(),

  updatedBy: Joi.string().allow(""),

  approvedBy: Joi.string().allow("")

});

module.exports = questionValidation;