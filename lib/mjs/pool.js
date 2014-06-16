// Worker pool: either with child processes or just emulated
//

function ForkPool (module, num) {
  var cp = require('child_process');

  this.workers = [];
  this.busy = [];
  this.closed = false;

  // The first worker is always the current process
  this.workers.push(require(module));

  for (var i=1; i<num; i++) {
    var worker = cp.fork(module);
    this.workers.push(worker);
  }
}

ForkPool.prototype.send = function (obj, cb) {
  var self = this;

  // Upon a response release the worker
  function callback (result) {
    if (!self.closed) {
      self.busy.splice(self.busy.indexOf(worker), 1);
      self.workers.push(worker);
      cb(result);
    }
  };

  // Wait for a worker to be available
  if (0 === this.workers.length) {
    setImmediate(function () { self.send(obj, cb); });
    return;
  }

  // Obtain a worker and flag it as busy
  var worker = this.workers.pop();
  this.busy.push(worker);
  worker.once('message', callback);
  worker.send(obj);
};
ForkPool.prototype.close = function () {
  this.closed = true;
  this.workers.concat(this.busy).forEach(function (w) {
    if (w.kill)
      w.kill();
  });
};  

function MockPool (module, num) {
  this.worker = require(module);
}

MockPool.prototype.send = function (obj, cb) {
  var self = this;

  function callback(result) {
    if (!self.closed) {
      cb(result);
    }
  }

  process.nextTick(function () { 
    self.worker.once('message', callback);
    self.worker.send(obj);
  });
};

MockPool.prototype.close = function () {
  this.closed = true;
};


exports.ForkPool = ForkPool;
exports.MockPool = MockPool;
