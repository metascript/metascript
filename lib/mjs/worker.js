// Simple module to compile based on a JSON given via argv.
// It's used internally by mjs to spawn compilations in parallel 

// Detect if we are running as a child process
var parent, child;
if (process.connected) {
  child = process;
} else {
  // Emulate child process event interface
  var EventEmitter = require('events').EventEmitter;
  parent = new EventEmitter();
  child = new EventEmitter();
  // Use setImmediate to allow queued operations to run
  parent.send = function (obj) {
    setImmediate(function () {
      child.emit('message', obj);
    });
  };
  child.send = function (obj) {
    setImmediate(function() {
      parent.emit('message', obj);
    });
  };
  module.exports = parent;
}

child.on('message', function (msg) {
  // console.log('CHILD', process.pid, msg.type);
  var result;
  if (msg.type === 'compile') {
    result = compile(msg.config, msg.code);
  } else if (msg.type === 'compiler-string') {
    result = compileString(msg.config, msg.code);
  } else {
    throw new Error('Unknown msg type: ' + msg.type);
  }
  child.send(result);
});


var Meta = require('../meta.js')();

function makeCompiler(config, code) {
  var compiler;
  Meta.setOptions(config);
  if (code == null) {
    compiler = Meta.compilerFromFile(config.source);  
  } else {
    compiler = Meta.compilerFromString(code, config.source);
  }
  return compiler;
}

function compile(config, code) {
  var compiler = makeCompiler(config, code);
  code = compiler.compile();
  if (config.output) {
    code = null
  }
  return {pid: process.pid, code: code, errors: compiler.errors};
}

function lint(config, code) {
  var compiler = makeCompiler(config, code);
  compiler.parse(true);
  var errors = lint(compiler.root);
  return {pid: process.pid, code: null, errors: errors };
}
