var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const cbusModules = require('./modules.js')

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



var testModules = 	[
  new cbusModules.CANACC4 (301),				    // type 0x01
  new cbusModules.CANACC5 (302),				    // type 0x02
  new cbusModules.CANACC8 (303),				    // type 0x03
	new cbusModules.CANACE3 (304),				    // type 0x04
	new cbusModules.CANACE8C (305),				    // type 0x05
	new cbusModules.CANLED64 (307),				    // type 0x07
  new cbusModules.CANACC4_2 (308),			    // type 0x08
	new cbusModules.CANSERVO (311),				    // type 0x0B
	new cbusModules.CANSERVO8C (319),				  // type 0x13
	new cbusModules.CANPAN (329),				      // type 0x1D
	new cbusModules.CANACE3C (330),				    // type 0x1E
	new cbusModules.CANSOL (334),				      // type 0x22
	new cbusModules.CANMIO_UNIVERSAL (332),		// type 0x20
	new cbusModules.A53A (358),					      // type 0x3A
	new cbusModules.CANINP (362),				      // type 0x3E
  new cbusModules.CANTEST (551),				    // type 0xFB
]
                
for (var i = 0; i < testModules.length; i++) {
    testModules[i].setCanId(i+10);
}

const NET_PORT = 5550;

let network = new simuator.cbusNetworkSimulator(NET_PORT, testModules);

console.log("setup <node number> - forces specific node into setp mode");
console.log("heartb - toggles heartb on/off");
console.log(" ");


// Process console input on a line by line basis
rl.on('line', function (cmd) {
	const msgArray = cmd.toString().split(" ");
	if (msgArray.length > 0) {
		switch(msgArray[0].toLowerCase()) {
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
				case "heartb":
						if (network.toggleHEARTB()) {
							console.log("HEARTB enabled");
						} else {
							console.log("HEARTB disabled");
						}
				break;
			default:
				console.log("unknown command");
				break;			
		}
	}
});
