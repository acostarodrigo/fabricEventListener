'use strict';

const listener = require('./listener');

listener.subcribeEvent(process.argv[2], process.argv[3], process.argv[4], 'perfTest', 'updatePerfTest');