var exec = require('child_process').exec;
require('should');


describe('mjs', function () {
  it('Should compile the test suite', function() {
    exec('./bin/mjs ./test/meta-test.mjs', function (error, stdout, stderr) {
      (error === null).should.equal(true);
      stdout.should.have.length(0);
      stderr.should.have.length(0);
    });
  });
});
