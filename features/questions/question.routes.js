const express = require("express");

const router = express.Router();

const QuestionController = require("./controllers/question.controller");
const questionIdController = require("./controllers/question.id.controller");
const questionValidationMiddleware = require("../../middleware/questions/questionValidation.middleware");

router.post("/create", questionValidationMiddleware, QuestionController.create);

router.get("/", QuestionController.getAll);
router.delete("/", QuestionController.delete);

//question-id-controllers
router.get("/next-question",questionIdController.nextQuestion);

router.get("/:id", QuestionController.getById);

router.put("/:id", QuestionController.update);

router.delete("/:id", QuestionController.delete);




module.exports = router;