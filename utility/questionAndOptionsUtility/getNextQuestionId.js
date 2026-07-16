const Question = require("../../features/questions/question.model");

const getNextQuestionId = async () => {
  const questions = await Question.find()
    .sort({ questionId: 1 })
    .select("questionId -_id");

  let expected = 1;

  for (const question of questions) {
    const current = Number(question.questionId.replace("QU", ""));

    if (current !== expected) {
      break;
    }

    expected++;
  }

  return `QU${String(expected).padStart(11, "0")}`;
};

module.exports = getNextQuestionId;