var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const cbusModules = require('./modules.js')

var testModules = 	[
                new cbusModules.CANACC5(300),
                new cbusModules.CANACC8(301),
				new cbusModules.CANACE8C (302),
				new cbusModules.CANINP (303),
				new cbusModules.CANMIO_UNIVERSAL (304),
                ]

const NET_PORT = 5550;

let network = new simuator.cbusNetworkSimulator(NET_PORT, testModules);

