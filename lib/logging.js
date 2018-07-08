'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var name = ' [check-git-status] ';
exports.log = {
    info: console.log.bind(console, chalk_1.default.gray(name)),
    good: console.log.bind(console, chalk_1.default.cyan(name)),
    veryGood: console.log.bind(console, chalk_1.default.green(name)),
    warning: console.log.bind(console, chalk_1.default.yellow.bold(name)),
    error: console.log.bind(console, chalk_1.default.red(name))
};
