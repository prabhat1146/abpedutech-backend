const jwt = require("jsonwebtoken");
const User = require("../features/users/user.schema");
const { success, error } = require("../utility/response");

exports.protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return error(
        res,
        null,
        "Not authorized. Please login first.",
        401
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return error(
        res,
        null,
        "User no longer exists.",
        401
      );
    }

    if (!user.isActive) {
      return error(
        res,
        null,
        "Your account is inactive.",
        403
      );
    }

    req.user = user;

    return next();
  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return error(
        res,
        null,
        "Invalid or expired token. Please login again.",
        401
      );
    }

    return error(
      res,
      null,
      "Authentication failed.",
      500
    );
  }
};