const generateOptionIds = require("../../../utility/questionAndOptionsUtility/generateOptionIds");
const getLastQuestion = require("../../../utility/questionAndOptionsUtility/getLastQuestion");
const getNextQuestionId = require("../../../utility/questionAndOptionsUtility/getNextQuestionId");
const { success, error } = require("../../../utility/response");
const QuestionService = require("../question.service");

class QuestionController {
  async create(req, res, next) {
    try {
      const payload = { ...req.body };

      console.log(payload);

      // const lastQuestionId = await getLastQuestion();
      const nextQuestionId = await getNextQuestionId();
      console.log(nextQuestionId);

      payload.questionId = nextQuestionId;

      // Generate option IDs
      const optionIds = generateOptionIds(
        nextQuestionId,
        payload.questionLang.eng.options.length,
      );

      console.log(optionIds);

      // English options
      payload.questionLang.eng.options = payload.questionLang.eng.options.map(
        (option, index) => ({
          ...option,
          optionId: optionIds[index],
        }),
      );

      // Hindi options
      payload.questionLang.hindi.options =
        payload.questionLang.hindi.options.map((option, index) => ({
          ...option,
          optionId: optionIds[index],
        }));

      const optionNo = Number(payload.correctAnswers);

      const correctOption =
        nextQuestionId.replace(/^QU/, "OP") + String(optionNo + 1);

      payload.correctAnswers = correctOption;

      // Save
      const question = await QuestionService.create(payload);

      return success(res, question, "Question created successfully.", 201);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const questions = await QuestionService.getAll(req.query);

      return success(res, questions, "Questions fetched successfully.");
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const question = await QuestionService.getById(req.params.id);

      return success(res, question, "Question fetched successfully.");
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const question = await QuestionService.update(req.params.id, req.body);

      return success(res, question, "Question updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      if (!req.params.id) {
        return error(res, null, "ID is not provided.", 400);
      }
      const response = await QuestionService.delete(req.params.id);

      if (response) {
        return success(res, null, "Question deleted successfully.");
      }
      console.log(req.params.id);

      return error(res, null, "Question Id not found.", 400);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QuestionController();
