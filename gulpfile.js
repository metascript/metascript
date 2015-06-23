var gulp = require('gulp');
var exec = require('gulp-exec');
var mocha = require('gulp-mocha');
var cache = require('gulp-cached');

var argv = require('minimist')(process.argv.slice(2));

// List of meta-script files to be compiled
var files = {
  'compiler': [
    './lib/compiler/*.mjs'
  ],
  'coremacros': [
    './lib/core-macros.mjs'
  ],
  'testlib': [
    'test/lib/*.mjs'
  ],
  'test': [
    'test/*.mjs'
  ]
};


var execOpts = {
  continueOnError: argv.watch
};


gulp.task('default', function (done) {
  if (argv.watch) {
    argv.watch = false;
    watch(['build']);
  }
  return gulp.start('build');
});

gulp.task('compiler', function () {
  // Uses the bootstrapping compiler
  return gulp.src(files.compiler)
  .pipe(cache('compiler'))
  .pipe(exec('./node_modules/.bin/mjs -v --color <%= file.path %>', execOpts))
  .pipe(exec.reporter())
});

gulp.task('coremacros', ['compiler'], function () {
  return gulp.src(files.coremacros)
  .pipe(cache('compiler'))
  .pipe(exec('./bin/mjs -v --color --skip-core <%= file.path %>', execOpts))
  .pipe(exec.reporter())
});

gulp.task('build', ['compiler', 'coremacros'], function (done) {
  done();
});

function mjs(src, cacheName) {
  return gulp.src(src)
  .pipe(cache(cacheName))
  .pipe(exec('./bin/mjs <%= file.path %>'))
  .pipe(exec.reporter());
}

gulp.task('build-testlib', ['build'], function () {
  return mjs(files.testlib, 'tests');
});

gulp.task('build-tests', ['build-testlib', 'build'], function () {
  return mjs(files.test, 'tests');
});

gulp.task('test', ['build-tests'], function () {
  if (argv.watch) {
    argv.watch = false;
    argv.reporter = argv.reporter || 'min';
    watch(['test']);
  }
  return gulp.src('./test/*.js', {read: false})
  .pipe(mocha({
    reporter: argv.reporter || 'dot',
    grep: argv.watchedGrep || argv.grep
  }));
});

gulp.task('regenerator', function (done) {
  // Dumps an escodegen AST for the regenerator minified runtime.
  // It allows to merge it directly into the generated program
  // to avoid breaking source maps.
  var fs = require('fs');
  var regenerator = require('regenerator');
  // HACK: Use recast from regenerator's deps
  var recast = require('regenerator/node_modules/recast');

  var runtime = fs.readFileSync('node_modules/regenerator/runtime.js', "utf-8");
  var body = recast.parse(runtime, {
    sourceFileName: regenerator.runtime.min,
  }).program.body;

  // Reduce source maps size by removing location information
  recast.visit(body, {
    visitNode: function (path) {
      path.node.loc = null;
      this.traverse(path);
    }
  });

  fs.writeFileSync('./lib/regenerator-runtime.json', JSON.stringify(body[0]))

  done();
});

function watch (tasks) {
  gulp.watch([
    './lib/mjs.js', './lib/meta.js', './lib/**/*.mjs',
    './test/test.js', './test/**/*.mjs'
  ], tasks)
  .on('change', function (evt) {
    var fpath = evt.path;

    if (evt.type === 'deleted') {
      if (fpath in cache.caches['compiler'])
        delete cache.caches['compiler'][fpath];
      if (fpath in cache.caches['tests'])
        delete cache.caches['tests'][fpath];
    }

    // Changes in the compiler invalidate the tests cache
    if (fpath.indexOf('/lib/') !== -1) {
      cache.caches['tests'] = {};
    }

    // TRICK: when we know the test that changed we will only run that one
    argv.watchedGrep = null;
    fpath.replace(/functional\/([^\/]+)\.mjs$/, function (m0, m1) {
      argv.watchedGrep = m1;
    });
  });
}
