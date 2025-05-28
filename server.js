const fs = require('fs');
// lets ensure the logs folder is empty
if (fs.existsSync("logs")) {
  fs.rmSync("logs", { recursive: true }) 
}

var winston = require('./config/winston.js');

const simuator = require('./CbusNetworkSimulator.js')

const cbusModules = require('./modules.js')

var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



var modules = [
  new cbusModules.CANACC5 (0)				  	      	// type 02 - un-initialised
  ,new cbusModules.CANACC8 (0)					        // type 03 - un-initialised
  ,new cbusModules.CANACC8 (0)					        // type 03 - un-initialised
  ,new cbusModules.CANTEST (1)				    	    // TEST
  ,new cbusModules.MMCTEST (2)				    	    // TEST
  ,new cbusModules.CAN4IN4OUT (3)				        // DEVELOPMENT
  ,new cbusModules.CAN1IN1OUT (4)				        // DEVELOPMENT
  ,new cbusModules.VLCBTEST (9)				          // DEVELOPMENT
  ,new cbusModules.CANACC4 (10)			      	    // type 01
  ,new cbusModules.CANACC5 (20)				  	      // type 02
  ,new cbusModules.CANACC8 (30)					        // type 03
	,new cbusModules.CANACE3 (40)  				        // type 04
	,new cbusModules.CANACE8C (50)				        // type 05
	,new cbusModules.CANLED64 (70)				        // type 07
  ,new cbusModules.CANACC4_2 (80)				        // type 08
  ,new cbusModules.CANCMD_4d (100)    	        // type 10
  ,new cbusModules.CANCMD_4f (101)   	          // type 10
	,new cbusModules.CANSERVO (110)				        // type 11
	,new cbusModules.CANTOTI (170)				        // type 17
	,new cbusModules.CANSERVO8C (190)				      // type 19
	,new cbusModules.CANPAN (290)				          // type 29
	,new cbusModules.CANPAN_4c (291)		          // type 29
	,new cbusModules.CANACE3C (300)				        // type 30
	,new cbusModules.CANPanel (310)				        // type 31
	,new cbusModules.CANMIO_3a (321)		          // type 32
	,new cbusModules.CANMIO_3c (323)		          // type 32
	,new cbusModules.CANMIO_3d (324)		          // type 32
	,new cbusModules.CANMIO_3e (325)		          // type 32
	,new cbusModules.CANMIO_4a (326)		          // type 32
	,new cbusModules.CANACE8MIO (330)		          // type 33
	,new cbusModules.CANSOL (340)				          // type 34
	,new cbusModules.CANSCAN (490)				        // type 49
	,new cbusModules.CANMIO_SVO (500)		          // type 50
	,new cbusModules.CANMIO_INP (510)		          // type 51
	,new cbusModules.CANMIO_OUT (520)		          // type 52
	,new cbusModules.CANBIP_OUT (530)		          // type 53
	,new cbusModules.CANCSB_4d (550)		          // type 55
	,new cbusModules.CANCSB_4f (551)		          // type 55
	,new cbusModules.CANPiNODE (580)		          // type 58
	,new cbusModules.CANCOMPUTE (600)		          // type 60
	,new cbusModules.CANINP (620)				          // type 62
	,new cbusModules.CANXIO_46K80_3e (640)        // type 64
	,new cbusModules.CANXIO_46K80_4a (641)        // type 64
	,new cbusModules.CANXIO_27Q84_4a (642)        // type 64
  ,new cbusModules.CANLEVER (800)				        // type 80
  ,new cbusModules.CANCMDB_4f (830)			        // type 83
  ,new cbusModules.CANARGB_1a (870)			        // type 87
	,new cbusModules.CANMIO_test_adapter (65000)  // type 32
	,new cbusModules.CANMIO_UUT (65001)           // type 32
  ,new cbusModules.CANCMD_4f (65534)   	        // type 10
  ,new cbusModules.CANCAB (65535)   		        // type 09
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
      case "heartbeat":
					if (msgArray.length > 1) {
						var nodeNumber = parseInt(msgArray[1]);
						if (nodeNumber) {
							network.toggleHEARTBEAT(nodeNumber);
						}	else {
							console.log("heartbeat: argument not a number");
						}
					}	else {
						console.log("heartbeat: no node number found");
					}
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
  console.log("CTRL-C twice             - terminates running");
  console.log("help                     - shows this text");
  console.log("events <node number>     - toggles transmitting of events on/off for specific node");
  console.log("heartbeat <node number>  - toggles the sending of heartb messages on/off for specific module");
  console.log("list events              - list all events");
  console.log("list modules             - list all modules");
  console.log("setup <node number>      - forces specific node into setup mode");
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
