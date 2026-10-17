const mongoose = require("mongoose");

const MockTest = require("../mocktest.model");
const MockTestAttempt = require("./MockTestAttempt.model");
const Question = require("../../questions/questionSchema");

// Get authenticated user ID
const getUserId = (req) => req.user?._id || req.user?.id;

// Validate MongoDB ObjectId
const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value);

// Find an attempt belonging to the authenticated student
const getStudentAttempt = async (attemptId, studentId) => {
  if (!isValidObjectId(attemptId)) return null;

  return MockTestAttempt.findOne({
    _id: attemptId,
    student: studentId,
  });
};

// Remove correct answers before sending questions to students
const sanitizeQuestion = (question) => {
  const data = question?.toObject
    ? question.toObject()
    : { ...question };

  [
    "correctAnswer",
    "correctOption",
    "answer",
    "answers",
    "explanation",
    "solution",
    "answerExplanation",
  ].forEach((key) => {
    delete data[key];
  });

  return data;
};

// Check test availability
const checkTestAvailability = (mockTest, now = new Date()) => {
  if (mockTest.status !== "Published") {
    return "This mock test is not published.";
  }

  if (
    mockTest.availabilityStartTime &&
    now < new Date(mockTest.availabilityStartTime)
  ) {
    return "This mock test is not available yet.";
  }

  if (
    mockTest.lastAttemptStartTime &&
    now > new Date(mockTest.lastAttemptStartTime)
  ) {
    return "The last time to start this mock test has passed.";
  }

  if (
    !mockTest.lastAttemptStartTime &&
    mockTest.availabilityEndTime &&
    now > new Date(mockTest.availabilityEndTime)
  ) {
    return "The availability window for this mock test has ended.";
  }

  return null;
};

// Get questions in the exact order configured in the section
const getOrderedSectionQuestions = async (section) => {
  const ids = section.questions || [];

  if (!ids.length) return [];

  const found = await Question.find({
    _id: { $in: ids },
  });

  const questionMap = new Map(
    found.map((question) => [
      String(question._id),
      question,
    ])
  );

  return ids
    .map((id) => questionMap.get(String(id)))
    .filter(Boolean);
};

// Get all sections and sanitize their questions
const getMockTestQuestions = async (mockTest) => {
  const sections = [];

  for (const section of mockTest.sections || []) {
    const questions = await getOrderedSectionQuestions(section);

    sections.push({
      sectionId: section.sectionId,
      title: section.title,
      description: section.description,
      instructions: section.instructions,
      duration: section.duration,
      totalQuestions:
        section.totalQuestions ?? questions.length,
      marksPerQuestion: section.marksPerQuestion,
      negativeMarking: section.negativeMarking,
      negativeMarksPerQuestion:
        section.negativeMarksPerQuestion,
      questions: questions.map(sanitizeQuestion),
    });
  }

  return sections;
};

// Public mock test data
const getPublicMockTest = async (mockTest) => ({
  _id: mockTest._id,
  id: mockTest.id,
  title: mockTest.title,
  attemptDuration: mockTest.attemptDuration,
  sections: await getMockTestQuestions(mockTest),
});

// Normalize answers for comparison
const normalize = (value) =>
  String(value).trim().toLowerCase();

// Extract the correct answer from a question
const getCorrectAnswer = (question) =>
  question.correctAnswer ??
  question.correctOption ??
  question.answer;

// Extract a comparable option value
const getOptionValue = (option) => {
  if (
    typeof option === "string" ||
    typeof option === "number"
  ) {
    return String(option);
  }

  if (!option || typeof option !== "object") {
    return undefined;
  }

  const value =
    option.optionId ??
    option.id ??
    option.value ??
    option.text ??
    option.label;

  return value === undefined || value === null
    ? undefined
    : String(value);
};

// Validate a selected option
const validateSelectedOption = (
  question,
  selectedOption
) => {
  if (
    selectedOption === "" ||
    selectedOption === null ||
    selectedOption === undefined
  ) {
    return null;
  }

  if (
    typeof selectedOption !== "string" &&
    typeof selectedOption !== "number"
  ) {
    return "selectedOption must be a string, number, or empty.";
  }

  const options = Array.isArray(question.options)
    ? question.options
    : Array.isArray(question.answers)
      ? question.answers
      : null;

  if (options && options.length > 0) {
    const validValues = options
      .map(getOptionValue)
      .filter((value) => value !== undefined);

    if (
      !validValues.some(
        (value) => value === String(selectedOption)
      )
    ) {
      return "Invalid selected option.";
    }
  }

  return null;
};

// Get every question ID included in the mock test
const getQuestionIdsForTest = (mockTest) =>
  (mockTest.sections || []).flatMap((section) =>
    (section.questions || []).map((id) => String(id))
  );

// ======================================================
// START OR RESUME MOCK TEST
// ======================================================

exports.startMockTest = async (req, res) => {
  try {
    const studentId = getUserId(req);
    const { id } = req.params;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mock test ID.",
      });
    }

    const mockTest = await MockTest.findById(id);

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const availabilityError =
      checkTestAvailability(mockTest);

    if (availabilityError) {
      return res.status(400).json({
        success: false,
        message: availabilityError,
      });
    }

    // Resume an existing active attempt
    const existingAttempt =
      await MockTestAttempt.findOne({
        mockTest: mockTest._id,
        student: studentId,
        status: "InProgress",
      });

    if (existingAttempt) {
      if (
        new Date() >= new Date(existingAttempt.expiresAt)
      ) {
        existingAttempt.status = "Expired";
        existingAttempt.submittedAt =
          existingAttempt.expiresAt;

        await existingAttempt.save();

        return res.status(400).json({
          success: false,
          message: "Your previous attempt has expired.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Resuming your existing attempt.",
        attempt: existingAttempt,
        mockTest: await getPublicMockTest(mockTest),
      });
    }

    // Count previous attempts
    const previousAttempts =
      await MockTestAttempt.countDocuments({
        mockTest: mockTest._id,
        student: studentId,
      });

    if (
      mockTest.maxAttempts != null &&
      previousAttempts >= mockTest.maxAttempts
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You have reached the maximum number of attempts.",
      });
    }

    const startedAt = new Date();

    let expiresAt = mockTest.attemptDuration
      ? new Date(
          startedAt.getTime() +
            Number(mockTest.attemptDuration) *
              60 *
              1000
        )
      : mockTest.availabilityEndTime
        ? new Date(mockTest.availabilityEndTime)
        : null;

    if (
      mockTest.allowAttemptCompletionAfterEnd === false &&
      mockTest.availabilityEndTime
    ) {
      const availabilityEnd = new Date(
        mockTest.availabilityEndTime
      );

      if (!expiresAt || availabilityEnd < expiresAt) {
        expiresAt = availabilityEnd;
      }
    }

    if (
      !expiresAt ||
      Number.isNaN(expiresAt.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The mock test has no valid attempt duration or end time.",
      });
    }

    if (expiresAt <= startedAt) {
      return res.status(400).json({
        success: false,
        message:
          "There is not enough time left to start this test.",
      });
    }

    let attempt;

    try {
      attempt = await MockTestAttempt.create({
        mockTest: mockTest._id,
        student: studentId,
        attemptNumber: previousAttempts + 1,
        startedAt,
        expiresAt,
        status: "InProgress",
        answers: [],
      });
    } catch (error) {
      // Handle concurrent requests that create the same attempt number
      if (error?.code === 11000) {
        const activeAttempt =
          await MockTestAttempt.findOne({
            mockTest: mockTest._id,
            student: studentId,
            status: "InProgress",
          });

        if (
          activeAttempt &&
          new Date() < new Date(activeAttempt.expiresAt)
        ) {
          return res.status(200).json({
            success: true,
            message: "Resuming your existing attempt.",
            attempt: activeAttempt,
            mockTest: await getPublicMockTest(mockTest),
          });
        }

        return res.status(409).json({
          success: false,
          message:
            "An attempt was created concurrently. Please refresh and try again.",
        });
      }

      throw error;
    }

    await MockTest.updateOne(
      { _id: mockTest._id },
      { $inc: { totalAttempts: 1 } }
    );

    return res.status(201).json({
      success: true,
      message: "Mock test started successfully.",
      attempt,
      mockTest: await getPublicMockTest(mockTest),
    });
  } catch (error) {
    console.error("startMockTest error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start mock test.",
    });
  }
};

// ======================================================
// SAVE OR UPDATE ANSWER
// ======================================================

exports.saveAnswer = async (req, res) => {
  try {
    const studentId = getUserId(req);
    const { attemptId } = req.params;

    const {
      questionId,
      selectedOption = "",
      isMarkedForReview = false,
    } = req.body || {};

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    if (!isValidObjectId(questionId)) {
      return res.status(400).json({
        success: false,
        message: "A valid questionId is required.",
      });
    }

    if (typeof isMarkedForReview !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isMarkedForReview must be a boolean.",
      });
    }

    const attempt = await getStudentAttempt(
      attemptId,
      studentId
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    if (attempt.status !== "InProgress") {
      return res.status(400).json({
        success: false,
        message: "This attempt is no longer active.",
      });
    }

    if (new Date() >= new Date(attempt.expiresAt)) {
      attempt.status = "Expired";
      attempt.submittedAt = attempt.expiresAt;

      await attempt.save();

      return res.status(400).json({
        success: false,
        message: "Your attempt has expired.",
      });
    }

    const mockTest = await MockTest.findById(
      attempt.mockTest
    );

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const questionIdString = String(questionId);

    const belongsToTest = getQuestionIdsForTest(
      mockTest
    ).includes(questionIdString);

    if (!belongsToTest) {
      return res.status(400).json({
        success: false,
        message:
          "This question does not belong to this mock test.",
      });
    }

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    const optionError = validateSelectedOption(
      question,
      selectedOption
    );

    if (optionError) {
      return res.status(400).json({
        success: false,
        message: optionError,
      });
    }

    const normalizedSelectedOption =
      selectedOption === null ||
      selectedOption === undefined
        ? ""
        : String(selectedOption);

    const answerIndex = attempt.answers.findIndex(
      (answer) =>
        String(answer.question) === questionIdString
    );

    if (answerIndex >= 0) {
      attempt.answers[answerIndex].selectedOption =
        normalizedSelectedOption;

      attempt.answers[answerIndex].isMarkedForReview =
        isMarkedForReview;
    } else {
      attempt.answers.push({
        question: question._id,
        selectedOption: normalizedSelectedOption,
        isMarkedForReview,
      });
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Answer saved successfully.",
      answer: {
        question: questionIdString,
        selectedOption: normalizedSelectedOption,
        isMarkedForReview,
      },
    });
  } catch (error) {
    console.error("saveAnswer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save answer.",
    });
  }
};

// ======================================================
// SUBMIT AND EVALUATE MOCK TEST
// ======================================================

exports.submitMockTest = async (req, res) => {
  try {
    const studentId = getUserId(req);
    const { attemptId } = req.params;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await getStudentAttempt(
      attemptId,
      studentId
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    if (attempt.status !== "InProgress") {
      return res.status(400).json({
        success: false,
        message:
          "This attempt has already been submitted or expired.",
      });
    }

    const mockTest = await MockTest.findById(
      attempt.mockTest
    );

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const now = new Date();

    const isExpired =
      now >= new Date(attempt.expiresAt);

    const submissionTime = isExpired
      ? new Date(attempt.expiresAt)
      : now;

    let totalObtainedMarks = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;
    let totalEvaluated = 0;
    let totalUnconfigured = 0;

    const answerMap = new Map(
      attempt.answers.map((answer) => [
        String(answer.question),
        answer,
      ])
    );

    for (const section of mockTest.sections || []) {
      const sectionQuestions =
        await getOrderedSectionQuestions(section);

      const marksPerQuestion = Number(
        section.marksPerQuestion ?? 1
      );

      const negativeMarking =
        section.negativeMarking === true;

      const negativeMarksPerQuestion = Number(
        section.negativeMarksPerQuestion ?? 0
      );

      if (
        !Number.isFinite(marksPerQuestion) ||
        marksPerQuestion < 0 ||
        !Number.isFinite(negativeMarksPerQuestion) ||
        negativeMarksPerQuestion < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid marking configuration in the mock test.",
        });
      }

      for (const question of sectionQuestions) {
        totalEvaluated++;

        const savedAnswer = answerMap.get(
          String(question._id)
        );

        const selectedOption =
          savedAnswer?.selectedOption;

        if (
          selectedOption === undefined ||
          selectedOption === null ||
          selectedOption === ""
        ) {
          totalUnanswered++;
          continue;
        }

        const correctAnswer =
          getCorrectAnswer(question);

        if (
          correctAnswer === undefined ||
          correctAnswer === null
        ) {
          totalUnconfigured++;

          console.error(
            `Question ${question._id} has no configured correct answer.`
          );

          continue;
        }

        if (
          normalize(selectedOption) ===
          normalize(correctAnswer)
        ) {
          totalCorrect++;
          totalObtainedMarks += marksPerQuestion;
        } else {
          totalIncorrect++;

          if (negativeMarking) {
            totalObtainedMarks -=
              negativeMarksPerQuestion;
          }
        }
      }
    }

    if (totalUnconfigured > 0) {
      return res.status(500).json({
        success: false,
        message:
          "Some questions do not have a configured correct answer. Please contact the test administrator.",
      });
    }

    // Final score cannot be negative.
    totalObtainedMarks = Math.max(
      0,
      totalObtainedMarks
    );

    const passingMarks = Number(
      mockTest.passingMarks ?? 0
    );

    if (!Number.isFinite(passingMarks)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid passing marks configuration for this mock test.",
      });
    }

    const isPassed =
      totalObtainedMarks >= passingMarks;

    attempt.submittedAt = submissionTime;

    attempt.status = isExpired
      ? "Expired"
      : "Submitted";

    attempt.obtainedMarks = totalObtainedMarks;
    attempt.isPassed = isPassed;

    await attempt.save();

    if (!isExpired) {
      await MockTest.updateOne(
        { _id: mockTest._id },
        { $inc: { totalCompletions: 1 } }
      );
    }

    return res.status(200).json({
      success: true,
      message: isExpired
        ? "The attempt time expired. Your answers have been evaluated."
        : "Mock test submitted successfully.",
      result: {
        attemptId: attempt._id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        expiresAt: attempt.expiresAt,
        totalQuestions: totalEvaluated,
        totalCorrect,
        totalIncorrect,
        totalUnanswered,
        obtainedMarks: totalObtainedMarks,
        passingMarks,
        isPassed,
      },
    });
  } catch (error) {
    console.error("submitMockTest error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit mock test.",
    });
  }
};

// ======================================================
// GET STUDENT ATTEMPT AND RESULT
// ======================================================

exports.getMyAttempt = async (req, res) => {
  try {
    const studentId = getUserId(req);
    const { attemptId } = req.params;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await MockTestAttempt.findOne({
      _id: attemptId,
      student: studentId,
    }).populate({
      path: "mockTest",
      select:
        "id title subject class course attemptDuration passingMarks sections",
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    const responseAttempt = attempt.toObject();

    // Return section metadata without exposing question documents.
    if (responseAttempt.mockTest?.sections) {
      responseAttempt.mockTest.sections =
        responseAttempt.mockTest.sections.map(
          (section) => ({
            sectionId: section.sectionId,
            title: section.title,
            description: section.description,
            instructions: section.instructions,
            duration: section.duration,
            totalQuestions: section.totalQuestions,
            marksPerQuestion:
              section.marksPerQuestion,
            negativeMarking:
              section.negativeMarking,
            negativeMarksPerQuestion:
              section.negativeMarksPerQuestion,
          })
        );
    }

    return res.status(200).json({
      success: true,
      attempt: responseAttempt,
    });
  } catch (error) {
    console.error("getMyAttempt error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attempt.",
    });
  }
};