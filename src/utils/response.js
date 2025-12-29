const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    message
  });
};

const sendError = (res, message = 'Error', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: new Error().stack })
  });
};

const sendPaginated = (res, data, pagination, message = 'Success') => {
  res.json({
    success: true,
    data,
    pagination,
    message
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendPaginated
};

