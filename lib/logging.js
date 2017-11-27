"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chalk = require("chalk");
var name = ' [check-git-status] ';
exports.log = {
    info: console.log.bind(console, name),
    good: console.log.bind(console, chalk.cyan(name)),
    veryGood: console.log.bind(console, chalk.green(name)),
    warning: console.log.bind(console, chalk.yellow.bold(name)),
    error: console.log.bind(console, chalk.red(name))
};
