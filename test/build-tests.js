var exec = require('child_process').exec;
require('should');


['meta-module.mjs', 'meta-test.mjs', 'functional-test.mjs'].forEach(function (fname) {
  exec('./bin/mjs ./test/' + fname, function (error, stdout, stderr) {
    stdout.toString().should.equal('');
    stderr.toString().should.equal('');
    if (error) error.should.equal(null);
  });
});
