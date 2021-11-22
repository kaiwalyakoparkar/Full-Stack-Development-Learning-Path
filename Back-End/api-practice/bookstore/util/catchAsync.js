//================ Handling Async errors =================
module.exports = fu => {
  return (req, res, next) => {
    fu(req, res, next).catch(err => next(err));
  };
};
