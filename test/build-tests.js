var exec = require('child_process').exec;
require('should');


describe('mjs', function () {
  it('Should compile the test suite', function(done) {
    exec('./bin/mjs ./test/meta-test.mjs', function (error, stdout, stderr) {
      stdout.toString().should.equal('');
      stderr.toString().should.equal('');
      if (error) error.should.equal(null);
      done();
    });
  });
});
