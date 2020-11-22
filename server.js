var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const NET_PORT = 5550;

let network = new simuator.cbusNetworkSimulator(NET_PORT);

