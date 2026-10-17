const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// =======================
// Global Middlewares
// =======================

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// =======================
// Health Check
// =======================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ABP EduTech API is running 🚀"
    });
});

// =======================
// Feature Routes
// =======================

// app.use("/api/v1/auth", require("./features/auth/auth.routes"));
app.use("/api/v1/users", require("./features/users/user.route"));
app.use("/api/v1/questions", require("./features/questions/question.routes"));
app.use("/api/v1/academic-details/subjects", require("./features/academic/subjects/subjects.routes"));
app.use("/api/v1/academic-details/chapters", require("./features/academic/chapters/chapterRoutes"));
app.use("/api/v1/test/mocktest", require("./features/mocktests/mockTestRoutes"));
app.use("/api/v1/test/mocktest/:id/section", require("./features/mocktests/sections/sectionRoutes"));
//attempt
app.use("/api/v1/test/mocktest/attempt", require("./features/mocktests/mocktestAttempt/mockTestAttemptRoutes"));

// app.get("/test", (req, res) => {
//     res.send("Workingg");
// });
// =======================
// 404 Handler
// =======================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// =======================
// Global Error Handler
// =======================

app.use(errorHandler);

module.exports = app;