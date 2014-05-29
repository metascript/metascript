var util = require('util');
var fs = require('fs');
var Meta = require('./meta')();

function run() {
  var argv = process.argv.slice();
  argv.shift();
  argv.shift();

  var commandLineOptions = { emitIdentifierStatements: false };
  var skipMapGeneration = false;
  var skipOptionsFile = false;
  var fail = false;

  function checkArgument(option) {
    if (argv.length === 0) {
      console.log('Option \"' + option + '\" requires an argument.');
      fail = true;
      return false;
    } else if (typeof commandLineOptions[option] !== 'undefined') {
      console.log('Option \"' + option + '\" has been repeated, ignored.');
      return false;
    } else {
      return true;
    }
  }

  while (argv.length > 0) {
    var opt = argv.shift();
    switch (opt) {
      case '-v':
      case '--version':
        console.log('Metascript compiler version ' + Meta.version);
        process.exit(0);
        break;
      case '-i':
      case '--input':
      case '-s':
      case '--source':
        if (checkArgument(opt)) {
          commandLineOptions.source = argv.shift();
        }
        break;
      case '-o':
      case '-out':
      case '--output':
        if (checkArgument(opt)) {
          commandLineOptions.output = argv.shift();
        }
        break;
      case '-m':
      case '-map':
      case '--mapfile':
        if (checkArgument(opt)) {
          commandLineOptions.map = argv.shift();
        }
        break;
      case '--maproot':
        if (checkArgument(opt)) {
          commandLineOptions.mapRoot = argv.shift();
        }
        break;
      case '-nm':
      case '-nomap':
      case '--nomap':
        skipMapGeneration = true;
        break;
      case '-im':
      case '-sm':
      case '-imap':
      case '-smap':
      case '--inputInMap':
      case '--sourceInMap':
        commandLineOptions.sourceInMap = true;
        break;
      case '-sc':
      case '-nc':
      case '--skipCore':
      case '--noCore':
        commandLineOptions.skipCore = true;
        break;
      case '-fme':
      case '--fullMacroErrors':
        commandLineOptions.fullMacroErrors = true;
        break;
      case '-eis':
      case '--emitIdentifierStatements':
        commandLineOptions.emitIdentifierStatements = true;
        break;
      default:
        if (opt.indexOf('-') === 0) {
          console.log('Invalid option ' + opt);
          fail = true;
        } else {
          if (typeof commandLineOptions.source === 'undefined') {
            commandLineOptions.source = opt;
          } else {
            console.log('Source already specified.')
            fail = true;
          }
        }
    }
  }

  var optionsFromFile = {};
  if (!skipOptionsFile) {
    try {
      optionsFromFile = require('mjs-options');
    } catch (e) {}
  }
  for (var cmdOpt in commandLineOptions) {
    if (commandLineOptions.hasOwnProperty(cmdOpt)) {
      optionsFromFile[cmdOpt] = commandLineOptions[cmdOpt];
    }
  }

  if (fail || typeof optionsFromFile.source === 'undefined') {
    var usage = [
      'Source file not specified.',
      'Basic usage: mjs file.mjs [-o file.js -m file.js.map]',
      'Options (alternative aliases separated by commas, arguments enclosed in <>):',
      '  [-i, --input, -s, --source] <file> : input file',
      '           -o, -out, --output <file> : destination javascript file',
      '          -m, -map, --mapfile <file> : map file (use - to embed in output file)',
      '                    --maproot <root> : define a root for source map references',
      '                -nm, -nomap, --nomap : do not generate map file',
      '             -fme, --fullMacroErrors : emit full errors during macro expansion',
      '    -eis, --emitIdentifierStatements : emit top level identifier statements (use only in editors)',
      '              -im, -sm, -imap, -smap : include source in map file (experimental)',
      '      -sc, -nc, --skipCore, --noCore : do not load core macros'
    ];
    console.log(usage.join('\n'));
    fail = true;
  }

  if (!fail) {
    if (typeof optionsFromFile.output === 'undefined') {
      var source = optionsFromFile.source;
      var sourceEnd = source.substring(source.length - 4);
      if (sourceEnd === '.mjs') {
        source = source.substring(0, source.length - 4);
      }
      optionsFromFile.output = source + '.js';
    }

    if (skipMapGeneration) {
      if (typeof optionsFromFile.map !== 'undefined') {
        delete optionsFromFile.map;
      }
    } else {
      if (typeof optionsFromFile.map === 'undefined') {
        optionsFromFile.map = optionsFromFile.output + '.map';
      }
    }

    Meta.setOptions(optionsFromFile);
    var compiler = Meta.compilerFromFile(optionsFromFile.source);
    compiler.compile();

    if (compiler.errors.length > 0) {
      console.log('Errors:');
      compiler.logErrors();
      fail = true;
    }
  }

  if (fail) {
    process.exit(1);
  }
}

module.exports = run;
