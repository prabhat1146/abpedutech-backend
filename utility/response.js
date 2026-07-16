const success = (
  res,
  data = null,
  message = "Success",
  status = 200,
  meta = null,
) => {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(status).json(response);
};

const error = (
  res,
  data=null,
  message = "Something went wrong",
  status = 500,
  errors = null,
) => {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  success,
  error,
};
