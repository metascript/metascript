// Simple linter for metascript
// It requires a CST, which is just an augmented AST which preserves
// contents otherwise not needed by the compiler (white space, comments
// and new lines). It can be obtained by calling the parser from the
// compiler setting the isCst param to true.

var RULES = {

  WHITESPACE_AT_END_OF_LINE: function (expr) {
    for (var i = 0; i < expr.count - 1; i++) {
      if (expr.at(i).id === '<sp>' && expr.at(i + 1).id === '<nl>') {
        return expr.at(i).createError('white space at end of line');
      }
    }
  },

  UNEVEN_INDENTATION: function (expr) {
    if (expr.id === '<line>' && expr.count > 1) {
      var at0 = expr.at(0);
      if (at0.id === '<sp>' && at0.val.length % 2 !== 0) {
        return expr.at(1).createError('indentation is not a multiple of 2')
      }
    }
  },

  SPACES_ASSIGNMENT: function (expr) {
    for (var i = 1; i < expr.count-1; i++) {
      var arg = expr.at(i);
      if (arg.id === '<op>' && /[+*\/=-]/.test(arg.val)) {
        var prev = expr.at(i-1),
            next = expr.at(i+1);
            
        if (prev.id !== '<sp>' || next.id !== '<sp>') {
          return arg.createError('spacing expected around operators');
        }
        if (prev.val.length > 1) {
          return prev.createError('single space expected');
        } else if (next.val.length > 1) {
          return next.createError('single space expected');
        }
      }
    }
  }

}

module.exports = function (cst, rules) {

  if (typeof rules === 'undefined') {
    rules = Object.keys(RULES);
  } else {
    rules = rules.filter(function (rule) {
      if (!(rule in RULES)) {
        console.warn('Unknown rule ' + rule);
        return false;
      } else{
        return true;
      }
    });
  }

  var errors = [];
  cst.forEachRecursive(function (expr) {
    rules.forEach(function (rule) {
      var error = RULES[rule](expr);
      if (error) {
        errors.push(error);
      }
    });
  });

  return errors;
};