
const mongoose = require("mongoose");

const MockTest = require("../models/MockTest");
const MockTestAttempt = require("../models/MockTestAttempt");
const Question = require("../models/Question");

// Get the authenticated user's ID
const getUserId = (req) => req.user?._id || req.user?.id;

// Check whether an attempt belongs to the logged-in student
const getStudentAttempt = async (attemptId, studentId) => {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return null;
  }

  return MockTestAttempt.findOne({
    _id: attemptId,
    student: studentId,
  });
};

// Remove answer-related fields before returning questions to students
const sanitizeQuestion = (question) => {
  const data = question.toObject ? question.toObject() : { ...question };

  delete data.correctAnswer;
  delete data.correctOption;
  delete data.answer;
  delete data.explanation;

  return data;
};

// Check if a test is currently available
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

// Get questions for the mock test without exposing correct answers
const getMockTestQuestions = async (mockTest) => {
  const sections = [];

  for (const section of mockTest.sections || []) {
    const questions = await Question.find({
      _id: { $in: section.questions || [] },
    });

    sections.push({
      sectionId: section.sectionId,
      title: section.title,
      description: section.description,
      instructions: section.instructions,
      duration: section.duration,
      totalQuestions: section.totalQuestions,
      marksPerQuestion: section.marksPerQuestion,
      negativeMarking: section.negativeMarking,
      negativeMarksPerQuestion: section.negativeMarksPerQuestion,
      questions: questions.map(sanitizeQuestion),
    });
  }

  return sections;
};

// START MOCK TEST
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    const availabilityError = checkTestAvailability(mockTest);

    if (availabilityError) {
      return res.status(400).json({
        success: false,
        message: availabilityError,
      });
    }

    // Resume an existing attempt if it is still in progress
    const existingAttempt = await MockTestAttempt.findOne({
      mockTest: mockTest._id,
      student: studentId,
      status: "InProgress",
    });

    if (existingAttempt) {
      if (new Date() >= new Date(existingAttempt.expiresAt)) {
        existingAttempt.status = "Expired";
        existingAttempt.submittedAt = new Date();
        await existingAttempt.save();

        return res.status(400).json({
          success: false,
          message: "Your previous attempt has expired.",
        });
      }

      const sections = await getMockTestQuestions(mockTest);

      return res.status(200).json({
        success: true,
        message: "Resuming your existing attempt.",
        attempt: existingAttempt,
        mockTest: {
          _id: mockTest._id,
          id: mockTest.id,
          title: mockTest.title,
          attemptDuration: mockTest.attemptDuration,
          sections,
        },
      });
    }

    // Count all previous attempts for this student and test
    const previousAttempts = await MockTestAttempt.countDocuments({
      mockTest: mockTest._id,
      student: studentId,
    });

    if (
      mockTest.maxAttempts != null &&
      previousAttempts >= mockTest.maxAttempts
    ) {
      return res.status(400).json({
        success: false,
        message: "You have reached the maximum number of attempts.",
      });
    }

    const startedAt = new Date();

    let expiresAt = mockTest.attemptDuration
      ? new Date(
          startedAt.getTime() + mockTest.attemptDuration * 60 * 1000
        )
      : mockTest.availabilityEndTime
        ? new Date(mockTest.availabilityEndTime)
        : null;

    // If completion after the availability window is disabled,
    // the attempt cannot extend beyond the availability end time.
    if (
      mockTest.allowAttemptCompletionAfterEnd === false &&
      mockTest.availabilityEndTime
    ) {
      const availabilityEnd = new Date(mockTest.availabilityEndTime);

      if (!expiresAt || availabilityEnd < expiresAt) {
        expiresAt = availabilityEnd;
      }
    }

    if (!expiresAt) {
      return res.status(400).json({
        success: false,
        message: "The mock test has no valid attempt duration or end time.",
      });
    }

    if (expiresAt <= startedAt) {
      return res.status(400).json({
        success: false,
        message: "There is not enough time left to start this test.",
      });
    }

    const attempt = await MockTestAttempt.create({
      mockTest: mockTest._id,
      student: studentId,
      attemptNumber: previousAttempts + 1,
      startedAt,
      expiresAt,
      status: "InProgress",
      answers: [],
    });

    // Update attempt statistics
    await MockTest.updateOne(
      { _id: mockTest._id },
      { $inc: { totalAttempts: 1 } }
    );

    const sections = await getMockTestQuestions(mockTest);

    return res.status(201).json({
      success: true,
      message: "Mock test started successfully.",
      attempt,
      mockTest: {
        _id: mockTest._id,
        id: mockTest.id,
        title: mockTest.title,
        attemptDuration: mockTest.attemptDuration,
        sections,
      },
    });
  } catch (error) {
    console.error("startMockTest error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start mock test.",
      error: error.message,
    });
  }
};

// SAVE OR UPDATE AN ANSWER
exports.saveAnswer = async (req, res) => {
  try {
    const studentId = getUserId(req);
    const { attemptId } = req.params;
    const { questionId, selectedOption, isMarkedForReview = false } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({
        success: false,
        message: "A valid questionId is required.",
      });
    }

    if (
      typeof isMarkedForReview !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isMarkedForReview must be a boolean.",
      });
    }

    const attempt = await getStudentAttempt(attemptId, studentId);

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
      attempt.submittedAt = new Date();
      await attempt.save();

      return res.status(400).json({
        success: false,
        message: "Your attempt has expired.",
      });
    }

    const mockTest = await MockTest.findById(attempt.mockTest);

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found.",
      });
    }

    const belongsToTest = (mockTest.sections || []).some((section) =>
      (section.questions || []).some(
        (id) => id.toString() === questionId
      )
    );

    if (!belongsToTest) {
      return res.status(400).json({
        success: false,
        message: "This question does not belong to this mock test.",
      });
    }

    // Validate the selected option against the question's options.
    // Update this if your Question schema uses a different option structure.
    if (selectedOption !== null && selectedOption !== undefined) {
      const options = question.options || question.answers;

      if (Array.isArray(options) && options.length > 0) {
        const validOptions = options.map((option) => {
          if (typeof option === "string") return option;

          return option.optionId ?? option.id ?? option.value ?? option.text;
        });

        if (!validOptions.includes(selectedOption)) {
          return res.status(400).json({
            success: false,
            message: "Invalid selected option.",
          });
        }
      }
    }

    const answerIndex = attempt.answers.findIndex(
      (answer) => answer.question.toString() === questionId
    );

    const answerData = {
      question: questionId,
      selectedOption:
        selectedOption === undefined ? "" : selectedOption,
      isMarkedForReview,
    };

    if (answerIndex >= 0) {
      attempt.answers[answerIndex].selectedOption =
        answerData.selectedOption;
      attempt.answers[answerIndex].isMarkedForReview =
        answerData.isMarkedForReview;
    } else {
      attempt.answers.push(answerData);
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      message: "Answer saved successfully.",
      answer: answerData,
    });
  } catch (error) {
    console.error("saveAnswer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save answer.",
      error: error.message,
    });
  }
};

// SUBMIT AND EVALUATE MOCK TEST
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

    const attempt = await getStudentAttempt(attemptId, studentId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    if (attempt.status !== "InProgress") {
      return res.status(400).json({
        success: false,
        message: "This attempt has already been submitted or expired.",
      });
    }

    const mockTest = await MockTest.findById(attempt.mockTest);

    if (!mockTest) {
      return res.status(404).json({
        success: false,
        message: "Mock test not found.",
      });
    }

    const now = new Date();
    const isExpired = now >= new Date(attempt.expiresAt);

    // The server enforces the timer; do not trust a client-provided score.
    // If your product allows submission after the timer, adjust this policy.
    const submissionTime = isExpired
      ? new Date(attempt.expiresAt)
      : now;

    let totalObtainedMarks = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;
    let totalEvaluated = 0;

    const answerMap = new Map(
      attempt.answers.map((answer) => [
        answer.question.toString(),
        answer,
      ])
    );

    for (const section of mockTest.sections || []) {
      const sectionQuestions = await Question.find({
        _id: { $in: section.questions || [] },
      });

      for (const question of sectionQuestions) {
        totalEvaluated++;

        const savedAnswer = answerMap.get(question._id.toString());
        const selectedOption = savedAnswer?.selectedOption;

        if (
          selectedOption === undefined ||
          selectedOption === null ||
          selectedOption === ""
        ) {
          totalUnanswered++;
          continue;
        }

        const correctAnswer =
          question.correctAnswer ??
          question.correctOption ??
          question.answer;

        if (correctAnswer === undefined || correctAnswer === null) {
          console.error(
            `Question ${question._id} has no configured correct answer.`
          );
          continue;
        }

        const normalize = (value) =>
          String(value).trim().toLowerCase();

        const isCorrect =
          normalize(selectedOption) === normalize(correctAnswer);

        if (isCorrect) {
          totalCorrect++;

          const marks = Number(section.marksPerQuestion ?? 1);
          totalObtainedMarks += marks;
        } else {
          totalIncorrect++;

          if (section.negativeMarking) {
            const negativeMarks = Number(
              section.negativeMarksPerQuestion ?? 0
            );

            totalObtainedMarks -= negativeMarks;
          }
        }
      }
    }

    // Keep the total score from falling below zero.
    totalObtainedMarks = Math.max(0, totalObtainedMarks);

    const passingMarks = Number(mockTest.passingMarks ?? 0);
    const isPassed = totalObtainedMarks >= passingMarks;

    attempt.submittedAt = submissionTime;
    attempt.status = isExpired ? "Expired" : "Submitted";
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
      error: error.message,
    });
  }
};

// GET A STUDENT'S ATTEMPT AND RESULT
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

    // Avoid returning correct answers through the populated test.
    const responseAttempt = attempt.toObject();

    if (responseAttempt.mockTest?.sections) {
      responseAttempt.mockTest.sections =
        responseAttempt.mockTest.sections.map((section) => ({
          sectionId: section.sectionId,
          title: section.title,
          duration: section.duration,
          totalQuestions: section.totalQuestions,
          marksPerQuestion: section.marksPerQuestion,
          negativeMarking: section.negativeMarking,
          negativeMarksPerQuestion: section.negativeMarksPerQuestion,
        }));
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
      error: error.message,
    });
  }
};
