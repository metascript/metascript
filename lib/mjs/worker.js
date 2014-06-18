// Compilation worker module. It's designed to be used from a forked process 
// responding to action requests from the parent.

var Meta = require('../meta.js')();

// Detect if we are running as a child process
var parent, child;
if (process.connected) {
  child = process;
} else {
  // Emulate child process event interface
  var EE = require('events').EventEmitter;
  parent = new EE();
  child = new EE();
  // Allow queued tasks to run between compilation requests
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
  parent.pid = process.pid;
  module.exports = parent;
}

// Notify its readiness
child.send(process.pid);

child.on('message', function (msg) {
  var result;
  
  if (msg.type === 'compile') {
    result = compile(msg.config, msg.code);
  } else if (msg.type === 'compiler-string') {
    result = compileString(msg.config, msg.code);
  } else {
    throw new Error('Unknown msg type: ' + msg.type);
  }

  child.send(result);

  // Force garbage collection while we wait for next action
  global.gc && global.gc();
});


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
