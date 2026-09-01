// Logs incoming request query params, then hands control to the next function
const logger = (request, response, next) => {
  console.log("Query:", request.query);
  next();
};

module.exports = logger;
