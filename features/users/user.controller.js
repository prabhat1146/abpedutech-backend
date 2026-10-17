const User = require("./user.schema");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { success, error } = require("../../utility/response");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Hash OTP before storing it
const hashOtp = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

// Find account by email or phone
const findUserByIdentifier = (identifier) => {
  const value = identifier.trim();

  if (value.includes("@")) {
    return User.findOne({ email: value.toLowerCase() });
  }

  return User.findOne({ phone: value });
};

// Send OTP by email or SMS
const sendPasswordResetOtp = async (user, otp, method) => {
  if (method === "email") {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    });

    return;
  }

  if (method === "phone") {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: user.phone,
    });

    return;
  }

  throw new Error("Invalid verification method");
};

// REGISTER USER
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return error(res, null, "Name, email and password are required", 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return error(res, null, "Email already registered", 409);
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      phone,
    });

    const token = generateToken(user._id);

    return success(
      res,
      {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      "Registration successful",
      201
    );
  } catch (err) {
    if (err.code === 11000) {
      return error(res, null, "Email or phone already registered", 409);
    }

    if (err.name === "ValidationError") {
      return error(res, null, err.message, 400);
    }

    return error(res, null, "Registration failed", 500);
  }
};

// LOGIN USER
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, null, "Email and password are required", 400);
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return error(res, null, "Invalid email or password", 401);
    }

    if (!user.isActive) {
      return error(res, null, "Your account is inactive", 403);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    return success(
      res,
      {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profileImage: user.profileImage,
        },
      },
      "Login successful",
      200
    );
  } catch (err) {
    return error(res, null, "Login failed", 500);
  }
};

// GET MY PROFILE
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return error(res, null, "User not found", 404);
    }

    return success(res, { user }, "Profile fetched successfully", 200);
  } catch (err) {
    return error(res, null, "Failed to fetch profile", 500);
  }
};

// UPDATE MY PROFILE
exports.updateMyProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "phone", "profileImage"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return error(res, null, "No valid fields provided to update", 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return error(res, null, "User not found", 404);
    }

    return success(res, { user }, "Profile updated successfully", 200);
  } catch (err) {
    if (err.name === "ValidationError") {
      return error(res, null, err.message, 400);
    }

    return error(res, null, "Failed to update profile", 500);
  }
};

// CHANGE PASSWORD - logged-in user
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return error(
        res,
        null,
        "Current password and new password are required",
        400
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return error(res, null, "Password must be at least 6 characters", 400);
    }

    if (currentPassword === newPassword) {
      return error(
        res,
        null,
        "New password must be different from current password",
        400
      );
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return error(res, null, "User not found", 404);
    }

    if (!(await user.comparePassword(currentPassword))) {
      return error(res, null, "Current password is incorrect", 401);
    }

    user.password = newPassword;
    await user.save();

    return success(res, null, "Password changed successfully", 200);
  } catch (err) {
    if (err.name === "ValidationError") {
      return error(res, null, err.message, 400);
    }

    return error(res, null, "Failed to change password", 500);
  }
};

// FORGOT PASSWORD - request OTP by email or phone
exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || typeof identifier !== "string") {
      return error(res, null, "Email or phone number is required", 400);
    }

    const value = identifier.trim();
    const method = value.includes("@") ? "email" : "phone";

    const user = await findUserByIdentifier(value);

    // Do not reveal whether an account exists.
    if (!user || !user.isActive || (method === "phone" && !user.phone)) {
      return success(
        res,
        null,
        "If an active account matches, an OTP will be sent.",
        200
      );
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    user.passwordResetOtpHash = hashOtp(otp);
    user.passwordResetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpVerifiedUntil = undefined;

    await user.save();

    try {
      await sendPasswordResetOtp(user, otp, method);
    } catch (sendErr) {
      user.passwordResetOtpHash = undefined;
      user.passwordResetOtpExpires = undefined;
      user.passwordResetOtpAttempts = 0;
      await user.save();

      return error(
        res,
        null,
        "Unable to send OTP. Check your email/SMS configuration.",
        503
      );
    }

    return success(
      res,
      null,
      "If an active account matches, an OTP will be sent.",
      200
    );
  } catch (err) {
    return error(res, null, "Failed to request password reset", 500);
  }
};

// VERIFY FORGOT PASSWORD OTP
exports.verifyPasswordResetOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;

    if (!identifier || !otp) {
      return error(res, null, "Identifier and OTP are required", 400);
    }

    if (typeof identifier !== "string") {
      return error(res, null, "Invalid identifier", 400);
    }

    const user = await findUserByIdentifier(identifier).select(
      "+passwordResetOtpHash +passwordResetOtpExpires +passwordResetOtpAttempts"
    );

    if (!user || !user.isActive || !user.passwordResetOtpHash) {
      return error(res, null, "Invalid or expired OTP", 400);
    }

    if (
      !user.passwordResetOtpExpires ||
      user.passwordResetOtpExpires.getTime() < Date.now()
    ) {
      user.passwordResetOtpHash = undefined;
      user.passwordResetOtpExpires = undefined;
      user.passwordResetOtpAttempts = 0;
      await user.save();

      return error(res, null, "Invalid or expired OTP", 400);
    }

    if (user.passwordResetOtpAttempts >= 5) {
      return error(
        res,
        null,
        "Too many attempts. Request a new OTP.",
        429
      );
    }

    const validOtp =
      typeof otp === "string" &&
      /^\d{6}$/.test(otp) &&
      hashOtp(otp) === user.passwordResetOtpHash;

    if (!validOtp) {
      user.passwordResetOtpAttempts += 1;
      await user.save();

      return error(res, null, "Invalid or expired OTP", 400);
    }

    // OTP is consumed after successful verification.
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpires = undefined;
    user.passwordResetOtpAttempts = 0;
    user.passwordResetOtpVerifiedUntil = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    return success(
      res,
      null,
      "OTP verified. Reset your password within 10 minutes.",
      200
    );
  } catch (err) {
    return error(res, null, "Failed to verify OTP", 500);
  }
};

// RESET PASSWORD after OTP verification
exports.resetForgottenPassword = async (req, res) => {
  try {
    const { identifier, newPassword } = req.body;

    if (!identifier || !newPassword) {
      return error(
        res,
        null,
        "Identifier and new password are required",
        400
      );
    }

    if (typeof identifier !== "string") {
      return error(res, null, "Invalid identifier", 400);
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return error(res, null, "Password must be at least 6 characters", 400);
    }

    const user = await findUserByIdentifier(identifier).select(
      "+passwordResetOtpVerifiedUntil"
    );

    if (!user || !user.isActive) {
      return error(res, null, "Please verify your OTP first", 401);
    }

    if (
      !user.passwordResetOtpVerifiedUntil ||
      user.passwordResetOtpVerifiedUntil.getTime() < Date.now()
    ) {
      return error(
        res,
        null,
        "OTP verification expired. Request a new OTP.",
        401
      );
    }

    user.password = newPassword;
    user.passwordResetOtpVerifiedUntil = undefined;
    user.passwordResetOtpHash = undefined;
    user.passwordResetOtpExpires = undefined;
    user.passwordResetOtpAttempts = 0;

    await user.save();

    return success(
      res,
      null,
      "Password reset successfully. Please login again.",
      200
    );
  } catch (err) {
    if (err.name === "ValidationError") {
      return error(res, null, err.message, 400);
    }

    return error(res, null, "Failed to reset password", 500);
  }
};

// LOGOUT USER
exports.logoutUser = async (req, res) => {
  return success(
    res,
    null,
    "Logout successful. Remove the token from the client.",
    200
  );
};