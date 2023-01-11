var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const cbusModules = require('./modules.js')

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



var testModules = 	[
    new cbusModules.CANTEST (300),
    new cbusModules.CANACC5 (301),
    new cbusModules.CANACC8 (302),
	new cbusModules.CANACE8C (303),
	new cbusModules.CANINP (304),
	new cbusModules.CANMIO_UNIVERSAL (305),
]
                
for (var i = 0; i < testModules.length; i++) {
    testModules[i].setCanId(i+10);
}

const NET_PORT = 5550;

let network = new simuator.cbusNetworkSimulator(NET_PORT, testModules);

console.log("setup <node number> - forces specific node into setp mode");


// Process console input on a line by line basis
rl.on('line', function (cmd) {
	const msgArray = cmd.toString().split(" ");
	if (msgArray.length > 0) {
		switch(msgArray[0]) {
			case "help":
				console.log("");
				console.log("");
				console.log("=== Cbus Network Simulator Help ===");
				console.log("CTRL-C twice        - terminates running");
				console.log("help                - shows this text");
				console.log("setup <node number> - forces specific node into setp mode");
				console.log("");
				console.log("");
				break;
			case "setup":
					if (msgArray.length > 1) {
						if (parseInt(msgArray[1])) {
							var nodeNumber = parseInt(msgArray[1]);
							var module = undefined;
							// now try to find a matching modules
							for (var i = 0; i < testModules.length; i++) {
								if (nodeNumber == testModules[i].getNodeNumber()){
									module = testModules[i];
								}
							}
							if (module) {
								console.log("setup: matching module found");
								network.startSetup(module);
							}
							else {
								console.log("setup: no matching module");
							}
						}
						else {
							console.log("setup: argument not a number");
						}
					}
					else {
						console.log("setup: no node number found");
					}
				break;
			default:
				console.log("unknown command");
				break;			
		}
	}
});
