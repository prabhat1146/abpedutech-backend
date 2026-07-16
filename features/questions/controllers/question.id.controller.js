const Question = require("../question.model");
const { success } = require("../../../utility/response");

class QuestionController {

  async nextQuestion(req, res, next) {
    try {

      const question = await Question.findOne()
        .sort({ questionId: -1 })
        .select("questionId");

      let nextQuestionId = "QU00000000001";

      if (question) {
        const number = Number(question.questionId.replace("QU", ""));

        nextQuestionId = `QU${String(number + 1).padStart(11, "0")}`;
      }

      return success(
        res,
        { questionId: nextQuestionId },
        "Next Question ID generated successfully."
      );

    } catch (error) {
      next(error);
    }
  }

}

module.exports = new QuestionController();