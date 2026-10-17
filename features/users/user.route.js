const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMyProfile,
  updateMyProfile,
  logoutUser,
  changePassword,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetForgottenPassword,
} = require("./user.controller");

const { protect } = require("../../middleware/authmiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

// Profile routes
router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);
router.post("/logout", protect, logoutUser);

// Change password (login required)
router.put("/change-password", protect, changePassword);

// Forgot password (OTP verification)
router.post("/forgot-password/request-otp", requestPasswordResetOtp);
router.post("/forgot-password/verify-otp", verifyPasswordResetOtp);
router.post("/forgot-password/reset", resetForgottenPassword);

module.exports = router;