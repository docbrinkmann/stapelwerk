module.exports = {
  setNextCursor: function(requestParams, context, ee, next) {
    if (context.vars.response && context.vars.response.nextCursor) {
      context.vars.nextCursor = context.vars.response.nextCursor;
    }
    return next();
  }
};
