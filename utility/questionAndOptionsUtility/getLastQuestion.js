const Question = require("../../features/questions/questionSchema");

const getLastQuestion = async () => {
  const lastquestionObj = await Question.findOne()
    .sort({ questionId: -1 })
    .select("questionId");

  return lastquestionObj?.questionId;
};

module.exports = getLastQuestion;
