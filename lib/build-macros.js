var exec = require('child_process').exec;

exec('./bin/mjs -nc ./lib/core-macros.mjs', function (error, stdout, stderr) {
  var ok = true;
  var out = stdout.toString();
  if (out !== '') {
    process.stdout.write(out);
    ok = false;
  }
  var err = stderr.toString();
  if (err !== '') {
    process.stderr.write(err);
    ok = false;
  }
  if (error && error !== null) {
    process.stderr.write(error);
    ok = false;
  }
  if (!ok) {
    process.exit(-1);
  }
});
