const Question = require("./question.model");

class QuestionService {
  async create(data) {
    return await Question.create(data);
  }

  async getAll(query = {}) {
    return await Question.find(query);
  }

  async getById(id) {
    return await Question.findOne({ questionId: id });
  }

  async update(id, data) {
    return await Question.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
  }

  async delete(id) {
    return await Question.findOneAndDelete({
      questionId: id,
    });
  }
}

module.exports = new QuestionService();
