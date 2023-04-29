'use strict';
var winston = require('winston');		// use config from root instance

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

const Flags = {
  Consumer: 1,
  Producer: 2,
  FLiM: 4,
  Bootloading: 8,
  SelfConsuming:16,
  Learn:32
};


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
			
		this.nodeVariables = [];
		this.services = {};


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
	
	// nodeVariables
	getNodeVariables() { return this.nodeVariables}
	fillNodeVariables(variableCount) {
		for (var i = 0; i <= variableCount ; i++) {
			this.nodeVariables.push(0);
		}
	}
	
	// Services
	getServices() { 
//		winston.debug({message: 'CBUS Network Sim: services ' + JSON.stringify(this.services)});
		return this.services; 
	};
}


//
// CANACC4 - ID 1
//
module.exports.CANACC4 = class CANACC4 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACC4   ";
		
		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);	// Minor version number - decimal 113
		this.parameters[3] = 1;									// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 10;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;									// CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		
		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
  	this.addNewEvent('012D0102');
  	this.addNewEvent('012D0103');
  	this.addNewEvent('012D0104');
  	this.addNewEvent('012D0105');

	}
	shouldFeedback(eventIndex) { return true;}
}


//
// CANACC5 - ID 2
//
module.exports.CANACC5 = class CANACC5 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACC5   ";
		
		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);	// Minor version number - decimal 117 (0x75)
		this.parameters[3] = 2;									// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 12;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 1;									// CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
    // skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		
		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');

		this.services["0"] = {"ServiceIndex": 1, "ServiceType" : 1,	"ServiceVersion" : 1,
				"Diagnostics": { "1":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7 }
		}

	}


	shouldFeedback(eventIndex) { return true;}
}

//
// CANACC8 - ID 3
//
module.exports.CANACC8 = class CANACC8 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACC8   ";


		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "v".charCodeAt(0);	  // Minor version number - 118(0x76)
		this.parameters[3] = 3;									  // Module Id
		this.parameters[4] = 32;								  // Number of supported events
		this.parameters[5] = 3;									  // Number of event variables
		this.parameters[6] = 8;								    // Number of Node Variables
		this.parameters[7] = 2;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
			
  	this.addNewEvent('012D0101');
	}
}


//
// CANACE3 - ID 4
//
module.exports.CANACE3 = class CANACE3 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACE3   ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "g".charCodeAt(0);	// Minor version number - 103(0x67)
		this.parameters[3] = 4;									// Module Id
		this.parameters[4] = 0;								// Number of supported events
		this.parameters[5] = 0;									// Number of event variables
		this.parameters[6] = 1;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a consumer
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
			
	}
}

//
// CANACE8C - ID 5
//
module.exports.CANACE8C = class CANACE8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACE8C  ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);	// Minor version number - decimal 113 (0x71)
		this.parameters[3] = 5;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANLED64 - ID 7
//
module.exports.CANLED64 = class CANLED64 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "LED64  ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "g".charCodeAt(0);	// Minor version number - decimal 103 (0x67)
		this.parameters[3] = 7;									// Module Id
		this.parameters[4] = 248;								// Number of supported events
		this.parameters[5] = 17;									// Number of event variables
		this.parameters[6] = 0;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANACC4_2 - ID 8
//
module.exports.CANACC4_2 = class CANACC4_2 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACC4   ";
		
		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);	// Minor version number - decimal 113
		this.parameters[3] = 8;									// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 16;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
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
		
		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
	shouldFeedback(eventIndex) { return true;}
}




//
// CANCAB - ID 9
//
module.exports.CANCAB = class CANCAB extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "CAB    ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "h".charCodeAt(0);	// Minor version number - decimal 117 (0x75)
		this.parameters[3] = 9;									// Module Id
		this.parameters[4] = 0;								  // Number of supported events
		this.parameters[5] = 0;								  // Number of event variables
		this.parameters[6] = 0;								  // Number of Node Variables
		this.parameters[7] = 4;									// Major version number
		this.parameters[8] = Flags.Producer + Flags.Bootloading;	// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}
}


//
// CANCMD - ID 10
//
module.exports.CANCMD = class CANCMD extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "CMD    ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "d".charCodeAt(0);	// Minor version number - decimal 117 (0x75)
		this.parameters[3] = 10;								// Module Id
		this.parameters[4] = 255;								// Number of supported events
		this.parameters[5] = 32;								// Number of event variables
		this.parameters[6] = 32;								// Number of Node Variables
		this.parameters[7] = 4;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}
}


//
// CANSERVO - ID 11
//
module.exports.CANSERVO = class CANSERVO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "SERVO  ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "h".charCodeAt(0);	// Minor version number - decimal 117 (0x75)
		this.parameters[3] = 11;								// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 36;								// Number of Node Variables
		this.parameters[7] = 3;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;   // not a producer
		this.parameters[9] = 1;								  // CPU type
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANTOTI - ID 17
//
module.exports.CANTOTI = class CANTOTI extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "TOTI   ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);	// Minor version number - decimal 113 (0x71)
		this.parameters[3] = 17;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANSERVO8C - ID 19
//
module.exports.CANSERVO8C = class CANSERVO8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "SERVO8C";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);	// Minor version number - decimal 165 (0x75)
		this.parameters[3] = 19;								// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 37;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
    
  	this.addNewEvent('012D0101');
	}
}


//
// CANPAN - ID 29
//
module.exports.CANPAN = class CANPAN extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567// 
		this.NAME = "PAN    ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "y".charCodeAt(0);	// Minor version number - decimal 121 (0x79)
		this.parameters[3] = 29;								// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 13;								// Number of event variables
		this.parameters[6] = 1;								  // Number of Node Variables
		this.parameters[7] = 1;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 1;								  // CPU type
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANACE3C - type 30
//
module.exports.CANACE3C = class CANACE3C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACE3C  ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "a".charCodeAt(0);	// Minor version number - 97 (0x61)
		this.parameters[3] = 30;							  // Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 9;									// Number of Node Variables
		this.parameters[7] = 3;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
			
  	this.addNewEvent('012D0101');
	}
}


//
// CANPanel - ID 31
//
module.exports.CANPanel = class CANPanel extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "Panel  ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "b".charCodeAt(0);	// Minor version number - decimal 103 (0x67)
		this.parameters[3] = 31;								// Module Id
		this.parameters[4] = 255;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 17;								// Number of Node Variables
		this.parameters[7] = 1;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANMIO - type 32
//
module.exports.CANMIO = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";

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
		this.parameters[20] = 0;								// Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANACE8MIO - ID 33
//
module.exports.CANACE8MIO = class CANACE8MIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACE8MIO";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);	// Minor version number - decimal 113 (0x71)
		this.parameters[3] = 33;								// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANSOL - type 34
//
module.exports.CANSOL = class CANSOL extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "SOL    ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "b".charCodeAt(0);	// Minor version number - 98 (0x62)
		this.parameters[3] = 34;								// Module Id - 0x22
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 16;								// Number of Node Variables
		this.parameters[7] = 1;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;									// CPU type
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
    // skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		
		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANMIO-SVO - ID 50
//
module.exports.CANMIO_SVO = class CANMIO_SVO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO-SVO";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "s".charCodeAt(0);	// Minor version number - decimal 104 (0x68)
		this.parameters[3] = 50;								// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 37;								// Number of Node Variables
		this.parameters[7] = 4;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
    
  	this.addNewEvent('012D0101');
	}
}


//
// CANMIO-INP - ID 51
//
module.exports.CANMIO_INP = class CANMIO_INP extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO-INP";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "s".charCodeAt(0);	// Minor version number - decimal 104 (0x68)
		this.parameters[3] = 51;								// Module Id
		this.parameters[4] = 128;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 37;								// Number of Node Variables
		this.parameters[7] = 4;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
    
  	this.addNewEvent('012D0101');
	}
}


//
// CANMIO_OUT - ID 52
//
module.exports.CANMIO_OUT = class CANMIO_OUT extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO-OUT";

		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "b".charCodeAt(0);	  // Minor version number - 118(0x76)
		this.parameters[3] = 52;									  // Module Id
		this.parameters[4] = 32;								  // Number of supported events
		this.parameters[5] = 3;									  // Number of event variables
		this.parameters[6] = 12;								    // Number of Node Variables
		this.parameters[7] = 5;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANBIP_OUT - ID 53
//
module.exports.CANBIP_OUT = class CANBIP_OUT extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "BIP-OUT";

		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "b".charCodeAt(0);	  // Minor version number - 118(0x76)
		this.parameters[3] = 53;									  // Module Id
		this.parameters[4] = 32;								  // Number of supported events
		this.parameters[5] = 3;									  // Number of event variables
		this.parameters[6] = 12;								    // Number of Node Variables
		this.parameters[7] = 5;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a producer
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 0;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
		this.parameters[15] = 228;              // 15-18 manufacturers chip ID
		this.parameters[16] = 26;
		this.parameters[17] = 0;
		this.parameters[18] = 0;
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANPiNODE - ID 58
//
module.exports.CANPiNODE = class CANPiNODE extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "PiNODE ";

		this.parameters[1] = 0xA5;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 58;								// Module Id - 0x3A
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = 12;								// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 0xD;								// Flags - not a producer
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// CANINP - type 62
//
module.exports.CANINP = class CANINP extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "INP    ";

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "s".charCodeAt(0);	// Minor version number - 115 (0x73)
		this.parameters[3] = 62;								// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = 9;									// Number of node variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a consumer
		this.parameters[9] = 1;								  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

  	this.addNewEvent('012D0101');
	}
}


//
// Unregistered test module
//
module.exports.CANTEST = class CANTEST extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		
		this.NAME = "CANTEST";

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = 35;								// Minor version number (#)
		this.parameters[3] = 0;								  // Module Id
		this.parameters[4] = 252;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 25;								// Number of Node Variables
		this.parameters[7] = 255;								// Major version number
		this.parameters[8] = 31;								// Flags - producer/consumer
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		
		this.parameters[0] = 20;								// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
		
		this.services["1"] = { "ServiceIndex": 3, "ServiceType" : 1, "ServiceVersion" : 0,
				"Diagnostics": { "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7 }
		}
		this.services["2"] = { "ServiceIndex": 4, "ServiceType" : 2, "ServiceVersion" : 0,
				"Diagnostics": { "1": 254, "2": 126 }
		};
		this.services["3"] = { "ServiceIndex": 5, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		this.services["4"] = {"ServiceIndex": 6, "ServiceType" : 4,	"ServiceVersion" : 1,
				"Diagnostics": { "1":1 }
		}
		this.services["5"] = {"ServiceIndex": 7, "ServiceType" : 5,	"ServiceVersion" : 1,
				"Diagnostics": { "1":1 }
		}
		this.services["6"] = {"ServiceIndex": 8, "ServiceType" : 6,	"ServiceVersion" : 1,
				"Diagnostics": { "1":1 }
		}
		this.services["7"] = {"ServiceIndex": 9, "ServiceType" : 9,	"ServiceVersion" : 1 }

		this.services["8"] = {"ServiceIndex": 10, "ServiceType" : 10,	"ServiceVersion" : 1 }

		this.services["9"] = {"ServiceIndex": 11, "ServiceType" : 11,	"ServiceVersion" : 1 }

		this.services["10"] = {"ServiceIndex": 12, "ServiceType" : 12,	"ServiceVersion" : 1 }

		this.services["11"] = {"ServiceIndex": 13, "ServiceType" : 13,	"ServiceVersion" : 1 }

		this.services["12"] = {"ServiceIndex": 14, "ServiceType" : 14,	"ServiceVersion" : 1 }

		this.services["13"] = {"ServiceIndex": 15, "ServiceType" : 15,	"ServiceVersion" : 1 }

		this.services["14"] = {"ServiceIndex": 16, "ServiceType" : 16,	"ServiceVersion" : 1 }

		this.services["15"] = {"ServiceIndex": 17, "ServiceType" : 17,	"ServiceVersion" : 1 }

		this.services["16"] = { "ServiceIndex": 255, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}

  	this.addNewEvent('012D0101');
	}
}

