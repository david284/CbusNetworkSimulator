var winston = require('./config/winston.js');

const Mock_Cbus = require('./CbusNetworkSimulator.js')

const NET_PORT = 5550;

let mock_Cbus = new Mock_Cbus.mock_CbusNetwork(NET_PORT);

