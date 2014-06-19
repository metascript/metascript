var MJS_RC = '.mjsrc';
var MJS_NPM = 'mjsConfig';

var fs = require('fs');
var path = require('path');


function parentpath(fromdir, pattern) {
  var pp = require('parentpath'),
      cwd = process.cwd();
  try {
    process.chdir(fromdir);
    return pp.sync(pattern);
  } catch (e) {
    return null;
  } finally {
    process.chdir(cwd);
  }
}

function fromNpm(dpath) {
  var config;
  var dir = parentpath(dpath, 'package.json');
  if (dir) {
    try {
      config = require(dir + '/package.json')[MJS_NPM];
      config.__origin__ = dir + '/package.json';
    } catch (e) {
    }
  }
  return config;
}

function fromResourceFile(dpath) {
  var candidates = [
    parentpath(dpath, MJS_RC),
    process.env.HOME, process.env.USERPROFILE, process.env.HOMEPATH, process.env.HOMEDRIVE + process.env.HOMEPATH
  ];

  var config;
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i] + '/' + MJS_RC;
    if (fs.existsSync(candidate)) {
      try {
        config = JSON.parse(fs.readFileSync(candidate));
        config.__origin__ = candidate;
        break;
      } catch (e) {
        throw new Error('Unable to read config from "' + candidate + '": ' + e.message);
      }
    }
  }
  return config;
}

// Get configuration from NPM package or from resource files
exports.getConfig = function(fpath, defaults) {
  var dpath = path.dirname(path.resolve(fpath));

  var config = fromNpm(dpath) || fromResourceFile(dpath) || {};
  // Make sure we apply defaults to missing values
  Object.keys(defaults).filter(function (k) {
    return config[k] == null
  }).forEach(function (k) {
    config[k] = defaults[k];
  });
  return config;
};
