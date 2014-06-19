// Compilation Worker pool
//

function ForkPool (module, num) {
  var cp = require('child_process');
  var self = this;

  this.workers = [];
  this.ready = [];
  this.closed = false;

  // If we just require one worker then let's use the parent process,
  // otherwise the parent is just used for coordination and child processes
  // are spawned for actual compilation.
  if (num === 1) {
    self.workers.push(require(module));
  } else {
    while (num--) {
      self.workers.push(cp.fork(module));
    }
  }

  // Wait for workers to report their readiness
  self.workers.forEach(function (worker) {
    // console.time('worker-' + worker.pid);
    worker.once('message', function (pid) {
      // console.timeEnd('worker-' + pid);
      self.ready.push(this);
    });
  });
}

ForkPool.prototype.send = function (obj, cb) {
  var self = this;
  var worker = this.ready.pop();

  // Wait for a worker to be available
  if (!worker) {
    setImmediate(function () { self.send(obj, cb); });
    return;
  }

  function callback (result) {
    // console.timeEnd('send-' + worker.pid);
    if (!self.closed) {
      self.ready.unshift(worker);
      cb(result);
    }
  };

  // console.time('send-' + worker.pid);
  worker.once('message', callback);
  worker.send(obj);
};

ForkPool.prototype.close = function () {
  this.closed = true;
  this.workers.forEach(function (worker) {
    if (worker.kill) {
      worker.kill();
    }
  });
};  


exports.ForkPool = ForkPool;
