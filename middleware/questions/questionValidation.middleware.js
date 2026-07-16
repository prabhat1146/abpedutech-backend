const questionValidation = require("../../features/questions/question.validation");

const fieldLabels = {
    questionId: "Question ID",
    "questionLang.eng.question": "English Question",
    "questionLang.eng.options": "English Options",
    "questionLang.eng.explanation": "English Explanation",
    "questionLang.eng.hint": "English Hint",

    "questionLang.hindi.question": "Hindi Question",
    "questionLang.hindi.options": "Hindi Options",
    "questionLang.hindi.explanation": "Hindi Explanation",
    "questionLang.hindi.hint": "Hindi Hint",

    questionType: "Question Type",
    correctAnswers: "Correct Answer(s)",
    difficulty: "Difficulty",

    "source.type": "Source Type",
    "source.examId": "Exam",
    "source.year": "Year",
    "source.shift": "Shift",
    "source.paper": "Paper",
    "source.questionNumber": "Question Number",

    subjectId: "Subject",
    chapterId: "Chapter",
    topicId: "Topic",
    subTopicId: "Sub Topic",

    tags: "Tags",
    keywords: "Keywords",

    status: "Status",
    visibility: "Visibility",

    attachments: "Attachments",

    createdBy: "Created By",
    updatedBy: "Updated By",
    approvedBy: "Approved By"
};

module.exports = (req, res, next) => {

    const { error } = questionValidation.validate(req.body, {
        abortEarly: false,
        allowUnknown: false
    });

    if (!error) {
        return next();
    }

    const errors = error.details.map(item => {

        const field = item.path.join(".");
        const label = fieldLabels[field] || field;

        let message;

        switch (item.type) {

            case "any.required":
                message = `${label} is required.`;
                break;

            case "string.empty":
                message = `${label} cannot be empty.`;
                break;

            case "string.base":
                message = `${label} must be text.`;
                break;

            case "number.base":
                message = `${label} must be a valid number.`;
                break;

            case "array.base":
                message = `${label} must be a valid list.`;
                break;

            case "array.min":
                message = `${label} must contain at least ${item.context.limit} item(s).`;
                break;

            case "any.only":
                message = `${label} contains an invalid value.`;
                break;

            case "string.pattern.base":
                message = `${label} format is invalid.`;
                break;

            default:
                message = item.message.replace(/"/g, "");
        }

        return {
            field,
            label,
            validation: item.type,
            message
        };

    });

    return res.status(400).json({
        success: false,
        message: errors[0].message,
        errors
    });

};