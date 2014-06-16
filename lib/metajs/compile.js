// Simple module to compile based on a JSON given via argv.
// It's used internally by mjs to spawn compilations in parallel 

// var Meta = require('../meta.js')();


process.on('message', function (config) {
  // Meta.setOptions(config);
  // var compiler = Meta.compilerFromFile(config.source);
  // compiler.compile();
  // process.send(compiler.errors);
  process.send('done')
});
