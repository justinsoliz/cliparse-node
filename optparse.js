var minimist = require("minimist");
var _ = require("lodash");
var parsers = require("./parsers.js");

var availableOptionsText = function(options) {
  if(_.isEmpty(options)) {
    return '';
  } else {
    return "Available options: \n" + _.pluck(options, "helpText").join('\n') + '\n\n';
  }
};

var displayOptionNames = function(names) {
  return _.map(names, function(name) {
    if(name.length > 1) return '--' + name;
    else return '-' + name;
  }).join(", ");
};

var option = function(name, opts) {
  var options = opts || {};
  var names = [name].concat(options.aliases || []);
  var metavar = options.metavar || null;
  var parser = options.parser || parsers.stringParser;
  var helpT = options.helpT || "";
  var defaultValue = (typeof options.defaultValue !== 'undefined') ? options.defaultValue : null;

  return {
    names: names,
    getValue: function(cliOpts) {
        var value = _(names)
            .map(function(name) { return cliOpts[name]; })
            .find(function(v) { return typeof v !== 'undefined'; });
      if(value) {
        return parser(value);
      } else if(defaultValue !== null) {
        return { success: defaultValue };
      } else {
        return { error: "missing value" };
      }
    },
    helpText: function() {
      var name = displayOptionNames(names);
      if(metavar) name += ' ' + metavar.toUpperCase();
      return name + "\t\t\t\t" + helpT;
    }()
  };
};

var flag = function(name, opts) {
    var options = opts || {};
    options.parser = parsers.booleanParser;
    if(typeof options.defaultValue === 'undefined') options.defaultValue = false;
    return option(name, options);
};

var argument = function(name, opts) {
  var options = opts || {};
  var parser = options.parser || parsers.stringParser;
  var help = options.help || "";
  var defaultValue = typeof options.defaultValue !== "undefined" ? options.defaultValue : null;

  return {
    getValue: function(position, args) {
      var value = args[position];
      if(value) {
        return parser(value);
      } else if(defaultValue !== null) {
        return { success: defaultValue };
      } else {
        return { error: "missing value" };
      }
    },
    helpText: function() {
      if(defaultValue !== null) {
        return "[" + name.toUpperCase() + "]";
      } else {
        return name.toUpperCase();
      }
    }()
  };
};

var command = function(name, opts, cb) {
  var options = opts || {};
  var description = options.description || "";
  var args = options.args || [];
  var flags = options.options || [];
  var commands = options.commands || [];
  var action = typeof cb !== 'undefined' ? cb : null;
  return {
    name: name,
    args: args,
    options: flags,
    helpText: function(cliName) {
      var argList = _.pluck(args, "helpText").join(' ');
      return "Usage : " + cliName +"  " + name + " " + argList + "\n" +
          description + "\n\n" +
          availableOptionsText(flags);
    },
    singleLineHelp: "  " + name + " " + _.pluck(args, "helpText").join(' ') + "\t\t\t\t" + description,
    getValue: function(cliArgs, cliOpts, globalOpts) {
      var globalOptions = globalOpts || {};
      var parsedOptions = parsers.parseOptions(flags, cliOpts);

      if(parsers.isValid(parsedOptions)) {
        var matchedCommand = _.find(commands, function(command) {
          return command.name === cliArgs[0];
        });

        if(matchedCommand) {
          var commandResult = matchedCommand.getValue(_.drop(cliArgs, 1), cliOpts, parsedOptions.success);
          if(parsers.isError(commandResult)) {
            console.log(matchedCommand.helpText(name));
          }
        } else {
          var parsedArgs = parsers.parseArgs(args, cliArgs);

          if(action !== null && parsers.isValid(parsedArgs)) {
              action({
                args: parsedArgs.success,
                options: _.extend(parsedOptions.success, globalOpts)
              });
          } else {
            console.log(this.helpText());
          }
        }
      } else {
        return { errors: {} };
      }
    }
  };
};

var getProcessName = function(args) {
  if(args[0] === 'node') {
    return _.take(args, 2).join(" ");
  } else {
    return args[0];
  }
};

var cli = function(opts, cb) {
  var options = opts || {};
  var name = options.name || getProcessName(process.argv);
  var flags = options.options || [];
  var commands = options.commands || [];
  var args = options.args || [];
  var action = typeof cb !== 'undefined' ? cb : null;
  return {
    getValue: function(cliArgs, cliOpts) {
      var parsedOptions = parsers.parseOptions(flags, cliOpts);

      if(parsers.isValid(parsedOptions)) {
        var matchedCommand = _.find(commands, function(command) {
          return command.name === cliArgs[0];
        });

        if(matchedCommand) {
          var commandResult = matchedCommand.getValue(_.drop(cliArgs, 1), cliOpts, parsedOptions.success);
          if(parsers.isError(commandResult)) {
            console.log(matchedCommand.helpText(name));
          }
        } else {
          var parsedArgs = parsers.parseArgs(args, cliArgs);

          if(action !== null && parsers.isValid(parsedArgs)) {
              action({
                args: parsedArgs.success,
                options: parsedOptions.success
              });
          } else {
            console.log(this.helpText());
          }
        }
      } else {
        console.log(this.helpText());
      }

    },
    helpText: function() {
      return "Name + description\n\n" +
          availableOptionsText(flags) +
          "Available commands: \n" +
          _.pluck(commands, "singleLineHelp").join('\n');
    }
  };
};



var parseValues = function(cliApp, argv) {
  var aargv = (typeof argv === "undefined") ? process.argv : argv;

  var opts = {
      "boolean": true
  };

  var cliValues = minimist(aargv, opts);
  var options = _.omit(cliValues, "_");
  var args = cliValues._;

  if(args[0] === "node") {
    cliApp.getValue(_.drop(args, 2), options);
  } else {
    cliApp.getValue(_.drop(args, 1), options);
  }
};


module.exports = {
  parseValues: parseValues,
  cli: cli,
  command: command,
  argument: argument,
  option: option,
  flag: flag
};

