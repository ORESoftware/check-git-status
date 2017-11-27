"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.options = [
    {
        names: ['version', 'vn'],
        type: 'bool',
        help: 'Print the npm-link-up version, and exit 0.'
    },
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Print help menu for npm-link-up, and exit 0.'
    },
    {
        names: ['verbosity', 'v'],
        type: 'positiveInteger',
        help: 'Verbosity level is an integer between 1 and 3, inclusive.',
        default: 2
    },
    {
        names: ['log'],
        type: 'bool',
        help: 'Write to output log in project.',
        default: true
    },
    {
        names: ['force'],
        type: 'bool',
        help: 'Force execution at hand.',
        default: false
    },
    {
        names: ['completion'],
        type: 'bool',
        help: 'Generate bash-completion code.',
        hidden: true
    },
    {
        names: ['search-root'],
        type: 'string',
        help: 'The directory to search, this path can be anywhere you have permission on the filesystem.'
    },
];
