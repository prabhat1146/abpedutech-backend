const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

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
// app.use("/api/v1/users", require("./features/users/user.routes"));
app.use("/api/v1/questions", require("./features/questions/question.routes"));
app.use("/api/v1/academic-details/subjects", require("./features/academic/subjects/subjects.routes"));
// app.use("/api/v1/tests", require("./features/tests/test.routes"));

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

app.use((err, req, res, next) => {
    console.error(err);

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

module.exports = app;