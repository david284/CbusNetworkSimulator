var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const cbusModules = require('./modules.js')

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



var modules = [
  new cbusModules.CANTEST (200)				    // DEVELOPMENT
  ,new cbusModules.CANVLCB (201)				    // DEVELOPMENT
  ,new cbusModules.CANACC4 (301)			      // type 01
  ,new cbusModules.CANACC5 (302)				    // type 02
  ,new cbusModules.CANACC8 (303)				    // type 03
	,new cbusModules.CANACE3 (304)  			    // type 04
	,new cbusModules.CANACE8C (305)				    // type 05
	,new cbusModules.CANLED64 (307)				    // type 07
  ,new cbusModules.CANACC4_2 (308)			    // type 08
  ,new cbusModules.CANCAB (309)   			    // type 09
  ,new cbusModules.CANCMD (310)		    	    // type 10
	,new cbusModules.CANSERVO (311)				    // type 11
	,new cbusModules.CANTOTI (317)				    // type 17
	,new cbusModules.CANSERVO8C (319)				  // type 19
	,new cbusModules.CANPAN (329)				      // type 29
	,new cbusModules.CANACE3C (330)				    // type 30
	,new cbusModules.CANPanel (331)				    // type 31
	,new cbusModules.CANMIO (332)		          // type 32
	,new cbusModules.CANACE8MIO (333)		      // type 33
	,new cbusModules.CANSOL (334)				      // type 34
	,new cbusModules.CANMIO_SVO (350)		      // type 50
	,new cbusModules.CANMIO_INP (351)		      // type 51
	,new cbusModules.CANMIO_OUT (352)		      // type 52
	,new cbusModules.CANBIP_OUT (353)		      // type 53
	,new cbusModules.CANPiNODE (358)		      // type 58
	,new cbusModules.CANINP (362)				      // type 62
	,new cbusModules.CANXIO (364)		          // type 64
  ,new cbusModules.CANLEVER (380)				    // type 80
]
 
for (var i = 0; i < modules.length; i++) {
    modules[i].CanId = i+10;
}

const NET_PORT = 5550;

let network = new simuator.cbusNetworkSimulator(NET_PORT, modules);

showHelp();

// Process console input on a line by line basis
rl.on('line', function (cmd) {
	const msgArray = cmd.toString().split(" ");
	if (msgArray.length > 0) {
		switch(msgArray[0].toLowerCase()) {
			case "events":
					if (msgArray.length > 1) {
						var nodeNumber = parseInt(msgArray[1]);
						if (nodeNumber) {
							network.toggleSendEvents(nodeNumber);
						}	else {
							console.log("events: argument not a number");
						}
					}	else {
						console.log("events: no node number found");
					}
          break;
      case "heartb":
          network.toggleHEARTB()
          break;
			case "help":
        showHelp();
				break;
      case "list":
        switch(msgArray[1].toLowerCase()) {
          case "events":
            listEvents();
            break;
          case "modules":
            listModules();
            break;
        }
        break;
			case "setup":
					if (msgArray.length > 1) {
						var nodeNumber = parseInt(msgArray[1]);
						if (nodeNumber) {
							network.startSetup(nodeNumber);
						}	else {
							console.log("setup: argument not a number");
						}
					}	else {
						console.log("setup: no node number found");
					}
          break;
			default:
				console.log("unknown command");
				break;			
		}
	}
});

function showHelp() {
  console.log("");
  console.log("=== Cbus Network Simulator Help ===");
  console.log("CTRL-C twice         - terminates running");
  console.log("help                 - shows this text");
  console.log("events <node number> - toggles transmitting of events on/off for specific node");
  console.log("heartb               - toggles the sending of heartb messages on/off for all modules");
  console.log("list events          - list all events");
  console.log("list modules         - list all modules");
  console.log("setup <node number>  - forces specific node into setup mode");
  console.log("");
}

function listModules() {
  for (var i = 0; i < modules.length; i++) {
		console.log('module ' + modules[i].NAME + ' node number ' + modules[i].nodeNumber);
  }
}

function listEvents() {
  for (var i = 0; i < modules.length; i++) {
    var defaultEvents = modules[i].defaultEvents
    for (let j in defaultEvents) {
      var text = 'node ' + modules[i].nodeNumber + ' ' + modules[i].NAME + ' default ' + formatEvent(defaultEvents[j])
      console.log( text );      
    }
    var storedEvents = modules[i].storedEvents
    for (let j in storedEvents) {
      var text = 'node ' + modules[i].nodeNumber + ' ' + modules[i].NAME + ' stored ' + formatEvent(storedEvents[j])
      console.log( text );      
    }
  }
}

function formatEvent(event) {
  var result = 'eventID ' + event.eventName + ' variables ';
  for (let i in event.variables) {
    result += ' ' + event.variables[i]
  }
  return result
}
