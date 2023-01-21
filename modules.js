'use strict';
var winston = require('winston');		// use config from root instance

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

class CbusModule {
	constructor(nodeNumber) {
		this.events = []
		this.CanId = 0;
		this.setupMode = false;
		this.nodeNumber = nodeNumber;
		this.NAME = "UNINIT";
		this.parameters = 	[];
		// prefill parameters array to 21 elements to match dev guide 6c & put length in element 0 (not including 0)
		for (var i = 0; i < 21 ; i++) {
			this.parameters.push(0);
		}
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
			
		this.variables = [];
		this.services = {
			"0":{
				"ServiceIndex": 1,
				"ServiceType" : 1,
				"ServiceVersion" : 1,
				"Diagnostics": { "1":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7 }
			}
		}


		winston.info({message: 'CBUS Network Sim: starting CBUS module: node: ' + this.nodeNumber + " " + this.constructor.name});

	}
	
	// Module name
	getNAME() { return this.NAME; };
	
	// CAN Id
	getCanId() { return this.CanId; }
	setCanId(canId) { 
        this.CanId = canId; 
		winston.info({message: 'CBUS Network Sim: CBUS module: CAN_ID ' +  this.CanId + ' node: ' + this.nodeNumber + " " + this.constructor.name});
    }
	
	// Flags
	getFlags() {return this.parameters[8]}
	getFlagsHex() {return decToHex(this.parameters[8], 2)}
	
	// Events
	addNewEvent(eventName) {
		winston.info({message: 'CBUS Network Sim: add new event: node ' + this.getNodeNumber() + ' eventName ' + eventName});
		var variables = [];
		// create variable array of correct length for specific module
		for (var index = 0; index <= this.parameters[5]; index++) {variables.push(0)};
		this.events.push({'eventName': eventName, "variables": variables});
		winston.info({message: 'CBUS Network Sim: events: ' + JSON.stringify(this.events)});
		return this.events[this.events.length - 1];		// adjust as array is zero based	
        
	}
    clearStoredEvents() { this.events = []; }
	getStoredEvents() { return this.events; }
	getStoredEventsCount() { return this.events.length; }
    getFreeSpace() { return 100; }
	
	// Feedback
	shouldFeedback() { return false;}
	
	//setup mode
	inSetupMode(){
		return this.setupMode;
		winston.info({message: 'CBUS Network Sim: Module setup mode ' + this.setupMode});
	}
	startSetupMode(){ 
		this.setupMode=true;
		winston.info({message: 'CBUS Network Sim: Module in setup mode'});
	}
	endSetupMode(){ 
		this.setupMode=false;
		winston.info({message: 'CBUS Network Sim: Module exiting setup mode'});
	}

	// Node Number
	getNodeNumber(){return this.nodeNumber}
	getNodeNumberHex(){return decToHex(this.nodeNumber, 4)}
	setNodeNumber(newNodeNumber) { 
		// can only accept new node number if in setup mode
		if (this.inSetupMode()){
			this.nodeNumber = newNodeNumber;
			this.endSetupMode();
			winston.info({message: 'CBUS Network Sim: Module has new node number ' + newNodeNumber});
		}
	}
	
	// Module Id
	getModuleId() {return this.parameters[3]}
	getModuleIdHex() {return decToHex(this.parameters[3], 2)}

	// Manufacturer Id
	getManufacturerId() {return this.parameters[1]}
	getManufacturerIdHex() {return decToHex(this.parameters[1], 2)}

	// Parameters
	getParameter(i) {return this.parameters[i]}
	
	// Variables
	getVariables() { return this.variables}
	fillVariables(variableCount) {
		for (var i = 0; i <= variableCount ; i++) {
			this.variables.push(i);
		}
	}
	
	// Services
	getServices() { 
//		winston.debug({message: 'CBUS Network Sim: services ' + JSON.stringify(this.services)});
		return this.services; 
	};
}

module.exports.CANACC5 = class CANACC5 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANACC5";
		
		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 2;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 12;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 0xD;								// Flags - not a producer
		this.parameters[9] = 1;									// CPU type
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		
		super.fillVariables(this.parameters[6])
			//NV1-8 channel variables
			//NV9 is feedback delay. In 0.5mSec intervals approx.
			//NV10 startup position. Bit set is OFF end, bit  clear is now go to last saved position
			//NV11 is move on startup. Bit set is move.
			//NV12 not used yet

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0, 0 ]})
			// EV#1 - sets which output is used (one bit per channel)
			// EV#2 - sets polarity (one bit per channel)
			// EV#3 - sets feedback
			//			EV3.  Bit format is  ABCNNNDD
			//			A must be set for a response event.
			//			B If set, reverses polarity of end events
			//			C If set, reverses polarity of mid point event
			//			NNN is the channel number (000 to 111) for channels 1 to 8)
			//			DD.  00 is event sent at ON
			//				 01 is event sent when at OFF
			//				 10 is event sent at mid travel
			//				 11 used to flag a SoD, bit 7 must be 0.
	}

	shouldFeedback(eventIndex) { return true;}
}

module.exports.CANACC8 = class CANACC8 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANACC8";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 3;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 12;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 0xD;								// Flags - not a producer
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillVariables(this.parameters[6])
			//NV1-8 channel variables
			//NV9 is feedback delay. In 0.5mSec intervals approx.
			//NV10 startup position. Bit set is OFF end, bit  clear is now go to last saved position
			//NV11 is move on startup. Bit set is move.
			//NV12 not used yet
			
		this.services["1"] = { "ServiceIndex": 2, "ServiceType" : 2, "ServiceVersion" : 2,
				"Diagnostics": { "1": 255, "2": 127 }
		};
		this.services["2"] = { "ServiceIndex": 255, "ServiceType" : 3, "ServiceVersion" : 1,
				"Diagnostics": { "1": 255, "2": 127, "3":255 }
		}			

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0, 0 ]})
			// EV#1 - sets which output is used (one bit per channel)
			// EV#2 - sets polarity (one bit per channel)
			// EV#3 - sets feedback
			//			EV3.  Bit format is  ABCNNNDD
			//			A must be set for a response event.
			//			B If set, reverses polarity of end events
			//			C If set, reverses polarity of mid point event
			//			NNN is the channel number (000 to 111) for channels 1 to 8)
			//			DD.  00 is event sent at ON
			//				 01 is event sent when at OFF
			//				 10 is event sent at mid travel
			//				 11 used to flag a SoD, bit 7 must be 0.
	}
}

module.exports.CANSERVO8C = class CANSERVO8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 19;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}
}

module.exports.CANMIO_UNIVERSAL = class CANMIO_UNIVERSAL extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "a".charCodeAt(0);					// Minor version number
		this.parameters[3] = 32;								// Module Id
		this.parameters[4] = 255;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 127;								// Number of Node Variables
		this.parameters[7] = 3;									// Major version number
		this.parameters[8] = 31;								// Flags - producer/consumer
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 3;								// Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillVariables(this.parameters[6])

		this.services["1"] = { "ServiceIndex": 2, "ServiceType" : 2, "ServiceVersion" : 2,
				"Diagnostics": { "1": 255, "2": 127 }
		};
		this.services["2"] = { "ServiceIndex": 255, "ServiceType" : 3, "ServiceVersion" : 1,
				"Diagnostics": { "3": 255, "4": 127 }
		}

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0, 0 ]})
	}
}

module.exports.CANCAB = class CANCAB extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANCAB";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 8;									// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

module.exports.CANPAN = class CANPAN extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANPAN";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 29;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

module.exports.CANCMD = class CANCMD extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANCMD";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 10;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

module.exports.CANACE8C = class CANACE8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANACE8C";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);					// Minor version number
		this.parameters[3] = 5;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 15;								// Flags
		this.parameters[9] = 1;								    // CPU type
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;                               // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 3;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillVariables(this.parameters[6])

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0 ]})
	}
}

module.exports.CANINP = class CANINP extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		this.NAME = "CANINP";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 62;								// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of node variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 14;								// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillVariables(this.parameters[6])

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0, 0 ]})
	}
}

module.exports.CANMIO_OUT = class CANMIO_OUT extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 52;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}

}

module.exports.CANTEST = class CANTEST extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		
		this.NAME = "CANTEST";

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = 250;								// Minor version number
		this.parameters[3] = 251;								// Module Id
		this.parameters[4] = 252;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 20;								// Number of Node Variables
		this.parameters[7] = 253;								// Major version number
		this.parameters[8] = 31;								// Flags - producer/consumer
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 3;								// Beta version number - 0 if production
		
		this.parameters[0] = 20;								// Number of parameters (not including 0)

		super.fillVariables(this.parameters[6])
		
		this.services["1"] = { "ServiceIndex": 3, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		this.services["2"] = { "ServiceIndex": 4, "ServiceType" : 2, "ServiceVersion" : 0,
				"Diagnostics": { "1": 254, "2": 126 }
		};
		this.services["3"] = { "ServiceIndex": 255, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}

		this.events.push({'eventName': '012D0103', "variables":[ 0, 0, 0, 0 ]})
		this.events.push({'eventName': '012D0104', "variables":[ 0, 0, 0, 0 ]})
	}
}
