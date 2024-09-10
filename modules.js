'use strict';
const winston = require('winston');		// use config from root instance
var cbusLib = require('cbuslibrary')


// Scope:
// variables declared outside of the class are 'global' to this module only
// callbacks need a bind(this) option to allow access to the class members
// let has block scope (or global if top level)
// var has function scope (or global if top level)
// const has block scope (like let), but can't be changed through reassigment or redeclared



function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

const Flags = {
  Consumer: 1,
  Producer: 2,
  FLiM: 4,
  Bootloading: 8,
  SelfConsuming:16,
  Learn:32,
  VLCB: 64
};

function addBulkEvents(module, numberOfEvents){
  for (var i=1; i< numberOfEvents+1; i++) {
    module.addNewStoredEvent(module.getNodeNumberHex() + decToHex(i, 4));
  }
}



class CbusModule {
	constructor(nodeNumber) {
		this.defaultEvents = []
		this.storedEvents = []
    this.defaultEventsEnabled = false;
    this.sendEventIndex = 0;
		this.CanId = 0;
		this.setupMode = false
    this.sendZeroEV = true          // only certain modules don't respond if EV is zero
		this.nodeNumber = nodeNumber;
		this.NAME = "UNINIT";
		this.parameters = 	[10,1,2,3,4,5,6,7,8,9,10];  // minimum of 10 parameters
		// prefill parameters array to 21 elements to match dev guide 6c & put length in element 0 (not including 0)
		for (var i = 0; i < 21 ; i++) {	this.parameters.push(0); }
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		this.nodeVariables = [];
		this.services = {};
    this.NVsetNeedsLearnMode = false;
		this.HeartBeatEnabled = false;
		winston.info({message: 'modules: starting CBUS module: node: ' + this.nodeNumber + " " + this.constructor.name});
	} // end constructor
	

  //-----------------------------------------------------------------------------
	// Events
  //-----------------------------------------------------------------------------
	addNewDefaultEvent(eventName) {
		winston.debug({message: 'modules: add new default event: node ' + this.nodeNumber + ' eventName ' + eventName});
		var variables = [];
		// create variable array of correct length for specific module
		for (var index = 0; index <= this.parameters[5]; index++) {variables.push(0)};
		this.defaultEvents.push({'eventName': eventName, "variables": variables});
		winston.debug({message: 'modules: events: ' + JSON.stringify(this.defaultEvents)});
		return this.defaultEvents[this.defaultEvents.length - 1];		// adjust as array is zero based	    
	}
	addNewStoredEvent(eventName) {
		winston.debug({message: 'modules: add new stored event: node ' + this.nodeNumber + ' eventName ' + eventName});
		var variables = [];
    variables[0] = this.parameters[5]
		// create variable array of correct length for specific module
		for (var index = 1; index <= this.parameters[5]; index++) {variables.push(0)};
		this.storedEvents.push({'eventName': eventName, "variables": variables});
		winston.debug({message: 'modules: events: ' + JSON.stringify(this.storedEvents)});
		return this.storedEvents[this.storedEvents.length - 1];		// adjust as array is zero based	    
	}
  clearStoredEvents() { this.storedEvents = []; }
	getStoredEventsCount() {
		var count = 0
    for (var key in this.storedEvents) { count++;};
		return count
  }
  getFreeSpace() { return 100; }
  toggleSendEvents(value){
      if(this.isProducer()) { 
        if (this.defaultEventsEnabled) {
          winston.info({message: 'modules: enableEvents: disabled for node ' + this.nodeNumber + ' ' + this.NAME});
          this.defaultEventsEnabled = false
        } else {
          winston.info({message: 'modules: enableEvents: enabled for node ' + this.nodeNumber + ' ' + this.NAME});
          this.defaultEventsEnabled = true;
        }
      } else {
        winston.info({message: 'modules: Events not enabled - node ' + this.nodeNumber + ' ' + this.NAME +' is not a producer'})
        this.defaultEventsEnabled = false
      }
  }  
  sendEvents(){
    if (this.defaultEventsEnabled) {
      if (this.defaultEvents.length > 0) {
        if (this.sendEventIndex < this.defaultEvents.length ) {
          var event = this.defaultEvents[this.sendEventIndex]
          winston.debug({message: 'modules: node ' + this.nodeNumber + ' ' + this.NAME + ' event ' + event.eventName})
          this.sendEventIndex++
          return event
        } else {
          this.sendEventIndex = 0
        }
      }
    }
  }
  actionOffEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: node ' + this.nodeNumber + ' OFF event'})
  }
  actionOnEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: node ' + this.nodeNumber + ' ON event'})    
  }
	
  //-----------------------------------------------------------------------------
	// Feedback
  //-----------------------------------------------------------------------------
	shouldFeedback() { return false;}
	

  //-----------------------------------------------------------------------------
	// Node Number
  //-----------------------------------------------------------------------------
	getNodeNumberHex(){return decToHex(this.nodeNumber, 4)}
	setNodeNumber(newNodeNumber) { 
		// can only accept new node number if in setup mode
		if (this.inSetupMode()){
			this.nodeNumber = newNodeNumber;
			this.endSetupMode();
			winston.info({message: 'modules: Module has new node number ' + newNodeNumber});
		}
	}
	

  //-----------------------------------------------------------------------------
	// nodeVariables
  //-----------------------------------------------------------------------------
	fillNodeVariables(variableCount) {
		for (var i = 0; i <= variableCount ; i++) {
			this.nodeVariables.push(0);
		}
	}
	

  //-----------------------------------------------------------------------------
	// Parameters
  //-----------------------------------------------------------------------------
	getParameter(i) {return this.parameters[i]}
	getManufacturerId() {return this.parameters[1]}
	getManufacturerIdHex() {return decToHex(this.parameters[1], 2)}
	getModuleId() {return this.parameters[3]}
	getModuleIdHex() {return decToHex(this.parameters[3], 2)}
	getFlags() {return this.parameters[8]}
	getFlagsHex() {return decToHex(this.parameters[8], 2)}
  isProducer() {
    return this.parameters[8] & Flags.Producer
  }
  isVLCB() {
    return this.parameters[8] & Flags.VLCB
  }
	

  //-----------------------------------------------------------------------------
	// services
	//-----------------------------------------------------------------------------
	
  getServiceCount() {
		var count = 0
		if(this.services){
			for (var key in this.services) { count++;};
		}
		return count
	}
	/*
  getServiceDiagnosticCount(Service) {
		var count = 0
		if (Service != undefined){
			winston.debug({message: 'modules: getServiceDiagnosticCount - service ' + Service + ' ' + JSON.stringify(this.services[Service])});
			if (this.services[Service].Diagnostics){
				for (var key in this.services[Service].Diagnostics) { count++;};
			}
		}
		return count
	}
	*/


  //-----------------------------------------------------------------------------
	//setup mode
  //-----------------------------------------------------------------------------
	inSetupMode(){
		return this.setupMode;
		winston.info({message: 'modules: Module setup mode ' + this.setupMode});
	}
	startSetupMode(){ 
		this.setupMode=true;
		winston.info({message: 'modules: Module in setup mode'});
	}
	endSetupMode(){ 
		this.setupMode=false;
		winston.info({message: 'modules: Module exiting setup mode'});
	}
  getHeartBeatenabled(){ return this.HeartBeatEnabled;}
	setHeartBeatEnabled(HeartBeatEnabled){this.HeartBeatEnabled = HeartBeatEnabled;}
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
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
		
		super.fillNodeVariables(this.parameters[6])

    this.addNewDefaultEvent(decToHex(0, 4) + decToHex(1, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(101, 4));

	}
	shouldFeedback(eventIndex) { return false;}
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

    this.addNewDefaultEvent(decToHex(0, 4) + decToHex(2, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(102, 4));

		this.services["0"] = {"ServiceIndex": 1, "ServiceType" : 1,	"ServiceVersion" : 1,
				"Diagnostics": { "1":1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7 }
		}

	}
	shouldFeedback(eventIndex) { return false;}
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
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
			
    this.addNewDefaultEvent(decToHex(0, 4) + decToHex(3, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(103, 4));
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
		this.parameters[4] = 0;								  // Number of supported events
		this.parameters[5] = 0;									// Number of event variables
		this.parameters[6] = 1;									// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags - not a consumer
		this.parameters[9] = 1;									  // CPU type - P18F2480
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])			
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(1, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(2, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(3, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(4, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(5, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(6, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(7, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(8, 4));
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
    addBulkEvents(this, 8)
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

    // no default events
	}
}


//
// CANACC4_2 - ID 8
//
module.exports.CANACC4_2 = class CANACC4_2 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "ACC4_2 ";
		
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

    // no default events
	}
	shouldFeedback(eventIndex) { return false;}
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

    // no default events
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
		this.parameters[5] = 10;								// Number of event variables
		this.parameters[6] = 144;								// Number of Node Variables
		this.parameters[7] = 4;									// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.Bootloading;	// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

    // no default events
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

    // no default events
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

    // no default events
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
    
    // no default events
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

    this.addNewDefaultEvent(decToHex(0, 4) + decToHex(29, 4));
  	this.addNewDefaultEvent(decToHex(nodeNumber, 4) + decToHex(129, 4));
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
			
    // no default events
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

    // no default events
	}
}


//
// CANMIO - type 32 - v3a
//
module.exports.CANMIO_3a = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

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

    addBulkEvents(this, 31)
	}
}


//
// CANMIO - type 32 - v3c
//
module.exports.CANMIO_3c = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "c".charCodeAt(0);					// Minor version number
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

    addBulkEvents(this, 31)
	}
}


//
// CANMIO - type 32 - v3d
//
module.exports.CANMIO_3d = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "d".charCodeAt(0);					// Minor version number
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

    addBulkEvents(this, 31)
	}
}


//
// CANMIO - type 32 - v3e
//
module.exports.CANMIO_3e = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "e".charCodeAt(0);					// Minor version number
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

    addBulkEvents(this, 31)
	}
}


//
// CANMIO - type 32 - v4a
//
module.exports.CANMIO_4a = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "a".charCodeAt(0);		// Minor version number
		this.parameters[3] = 32;								  // Module Id
		this.parameters[4] = 255;								  // Number of supported events
		this.parameters[5] = 20;								  // Number of event variables
		this.parameters[6] = 127;								  // Number of Node Variables
		this.parameters[7] = 4;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.VLCB;	// Flags
		this.parameters[9] = 13;								  // CPU type - P18F25K80
		this.parameters[10] = 1;								  // interface type
		this.parameters[11] = 0;                  // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								  // Code for CPU manufacturer 
		this.parameters[20] = 0;								  // Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

    addBulkEvents(this, 31)

    this.services["1"] = { "ServiceIndex": 1, "ServiceType" : 1, "ServiceVersion" : 0,
      "Diagnostics": { "0": 6, "1": 1, "2": 0, "3": 0, "4":4, "5":5, "6":6 }
    } 
    this.services["2"] = { "ServiceIndex": 2, "ServiceType" : 2, "ServiceVersion" : 0,
        "Diagnostics": { "0": 2, "1": 254, "2": 126 }
    }
    this.services["3"] = { "ServiceIndex": 3, "ServiceType" : 3, "ServiceVersion" : 0,
        "Diagnostics": { "0": 16, "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
                "9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
    }
    this.services["4"] = {"ServiceIndex": 4, "ServiceType" : 4,	"ServiceVersion" : 0,
        "Diagnostics": { "0": 1, "1":1 }
    }
    this.services["5"] = {"ServiceIndex": 5, "ServiceType" : 5,	"ServiceVersion" : 0,
        "Diagnostics": { "0": 1, "1":1 }
    }
    this.services["6"] = {"ServiceIndex": 6, "ServiceType" : 6,	"ServiceVersion" : 0,
        "Diagnostics": { "0": 1, "1":1 }
    }
    this.services["7"] = {"ServiceIndex": 7, "ServiceType" : 7,	"ServiceVersion" : 0 }
    this.services["8"] = {"ServiceIndex": 8, "ServiceType" : 8,	"ServiceVersion" : 0 }
    this.services["9"] = {"ServiceIndex": 9, "ServiceType" : 9,	"ServiceVersion" : 0 }
    this.services["10"] = {"ServiceIndex": 10, "ServiceType" : 10,	"ServiceVersion" : 0 }
    this.services["11"] = {"ServiceIndex": 11, "ServiceType" : 11,	"ServiceVersion" : 0 }
    this.services["12"] = {"ServiceIndex": 12, "ServiceType" : 12,	"ServiceVersion" : 0 }
    this.services["13"] = {"ServiceIndex": 13, "ServiceType" : 13,	"ServiceVersion" : 0 }
    this.services["14"] = {"ServiceIndex": 14, "ServiceType" : 14,	"ServiceVersion" : 0 }
    this.services["15"] = {"ServiceIndex": 15, "ServiceType" : 15,	"ServiceVersion" : 0 }
    this.services["16"] = {"ServiceIndex": 16, "ServiceType" : 16,	"ServiceVersion" : 0 }
    this.services["17"] = {"ServiceIndex": 17, "ServiceType" : 17,	"ServiceVersion" : 0 }

  }
}


//
// CANMIO - type 32 - test_adapter v3d
//
module.exports.CANMIO_test_adapter = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "d".charCodeAt(0);		// Minor version number
		this.parameters[3] = 32;								  // Module Id
		this.parameters[4] = 255;								  // Number of supported events
		this.parameters[5] = 20;								  // Number of event variables
		this.parameters[6] = 127;								  // Number of Node Variables
		this.parameters[7] = 3;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM;	// Flags
		this.parameters[9] = 13;								  // CPU type - P18F25K80
		this.parameters[10] = 1;								  // interface type
		this.parameters[11] = 0;                  // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								  // Code for CPU manufacturer 
		this.parameters[20] = 0;								  // Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])
    addBulkEvents(this, 8)

  }

  actionOffEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: test_adapter OFF event'})
		cbusLib.setCanHeader(2, simulator.getModule(65000).CanId);
		var msgData = cbusLib.encodeACOF(65000, eventNumber);
    simulator.broadcast(msgData)
  }

  actionOnEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: test_adapter ON event'})
		cbusLib.setCanHeader(2, simulator.getModule(65000).CanId);
		var msgData = cbusLib.encodeACON(65000, eventNumber);
    simulator.broadcast(msgData)
  }

}


//
// CANMIO - type 32 - UUT - V4a
//
module.exports.CANMIO_UUT = class CANMIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "MIO    ";
    this.sendZeroEV = false     // don't send zero EV's

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								  // Manufacturer Id - MERG
		this.parameters[2] = "a".charCodeAt(0);		// Minor version number
		this.parameters[3] = 32;								  // Module Id
		this.parameters[4] = 255;								  // Number of supported events
		this.parameters[5] = 20;								  // Number of event variables
		this.parameters[6] = 127;								  // Number of Node Variables
		this.parameters[7] = 4;									  // Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.VLCB;	// Flags
		this.parameters[9] = 13;								  // CPU type - P18F25K80
		this.parameters[10] = 1;								  // interface type
		this.parameters[11] = 0;                  // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																// skip 15 to 18
		this.parameters[19] = 1;								  // Code for CPU manufacturer 
		this.parameters[20] = 0;								  // Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		super.fillNodeVariables(this.parameters[6])

    addBulkEvents(this, 8)

  }

  actionOffEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: UUT OFF event'})
		cbusLib.setCanHeader(2, simulator.getModule(65535).CanId);
		var msgData = cbusLib.encodeACOF(65535, eventNumber);
    simulator.broadcast(msgData)
  }

  actionOnEvent(simulator, eventNumber){
    winston.info({message: 'CBUS Network Sim: modules: UUT ON event'})
		cbusLib.setCanHeader(2, simulator.getModule(65535).CanId);
		var msgData = cbusLib.encodeACON(65535, eventNumber);
    simulator.broadcast(msgData)
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

    // no default events
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

    // no default events
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
    
    // no default events
    this.NVsetNeedsLearnMode = true;

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
    
    // no default events
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

    // no default events
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

    // no default events
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

    // no default events
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

    // no default events
	}
}

//
// CANXIO - type 64
//
module.exports.CANXIO = class CANXIO extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "XIO    ";

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "e".charCodeAt(0);					// Minor version number
		this.parameters[3] = 64;								// Module Id
		this.parameters[4] = 255;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 183;								// Number of Node Variables
		this.parameters[7] = 3;									// Major version number
		this.parameters[8] = 31;								// Flags - producer/consumer
		this.parameters[9] = 13;								// CPU type - P18F25K80
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

    for (var i=1; i< 32; i++) {
      this.addNewStoredEvent(decToHex(nodeNumber, 4) + decToHex(i+600, 4));
    }
	}
}


//
// CANLEVER - type 80
//
module.exports.CANLEVER = class CANLEVER extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
               //1234567//
		this.NAME = "LEVER  ";

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - DEVELOPMENT
		this.parameters[2] = "a".charCodeAt(0);					// Minor version number
		this.parameters[3] = 80;								// Module Id
		this.parameters[4] = 255;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 127;								// Number of Node Variables
		this.parameters[7] = 1;									// Major version number
		this.parameters[8] = 31;								// Flags - producer/consumer
		this.parameters[9] = 13;								// CPU type - P18F25K80
		this.parameters[10] = 1;								// interface type
		this.parameters[11] = 0;                // 11-14 load address
		this.parameters[12] = 8;
		this.parameters[13] = 0;
		this.parameters[14] = 0;
																            // skip 15 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

    this.nodeVariables = [
      0, 0, 0, 234, 0, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      7, 0, 2, 1, 0, 0, 0,            // lever 1
      7, 0, 2, 1, 0, 0, 0,            // lever 2
      7, 0, 2, 1, 0, 0, 0,            // lever 3
      7, 0, 2, 1, 0, 0, 0,            // lever 4
      8, 128, 5, 15, 0, 15, 0,        // lock 1
      8, 128, 5, 15, 0, 15, 0,        // lock 2
      8, 128, 5, 15, 0, 15, 0,        // lock 3
      8, 128, 5, 15, 0, 15, 0,        // lock 4
      2, 20, 128, 128, 235, 235, 0,   // servo 1
      2, 20, 128, 128, 235, 235, 0,   // servo 2
      2, 20, 128, 128, 235, 235, 0,   // servo 3
      2, 20, 128, 128, 235, 235, 0,   // servo 4
      10, 0, 0, 0, 0, 0, 0,           // private
      10, 0, 0, 0, 0, 0, 0,           // private
      9, 0, 0, 0, 0, 0, 0,            // lock control
      10, 0, 0, 0, 0, 0, 0             // private
    ]
	}
}

//***************************************************************************************************************************
//
// DEVELOPMENT modules
//
//***************************************************************************************************************************

//
// Unregistered test module
//
module.exports.CANTEST = class CANTEST extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		
		this.NAME = "TESTDAE";

		// increase parameters array to 32 (plus zero)
		while(this.parameters.length < 33) {this.parameters.push(0);}

		this.parameters[1] = 13;								// Manufacturer Id - DEVELOPMENT
    this.parameters[2] = 97;								// Minor version number (a)
		this.parameters[3] = 0;								  // Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 25;								// Number of Node Variables
		this.parameters[7] = 1;								// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.VLCB;	// Flags
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

    this.nodeVariables[1] = 1;
    this.nodeVariables[this.parameters[6]] = this.parameters[6];

		
		this.services["1"] = { "ServiceIndex": 1, "ServiceType" : 1, "ServiceVersion" : 0,
				"Diagnostics": { "0": 6, "1": 1, "2": 0, "3": 0, "4":4, "5":5, "6":6 }
		}
		
		this.services["2"] = { "ServiceIndex": 2, "ServiceType" : 2, "ServiceVersion" : 0,
				"Diagnostics": { "0": 2, "1": 254, "2": 126 }
		};
		this.services["3"] = { "ServiceIndex": 3, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "0": 16, "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		this.services["4"] = {"ServiceIndex": 4, "ServiceType" : 4,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["5"] = {"ServiceIndex": 5, "ServiceType" : 5,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["6"] = {"ServiceIndex": 6, "ServiceType" : 6,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["7"] = {"ServiceIndex": 7, "ServiceType" : 7,	"ServiceVersion" : 0 }

		this.services["8"] = {"ServiceIndex": 8, "ServiceType" : 8,	"ServiceVersion" : 0 }

		this.services["9"] = {"ServiceIndex": 9, "ServiceType" : 9,	"ServiceVersion" : 0 }

		this.services["10"] = {"ServiceIndex": 10, "ServiceType" : 10,	"ServiceVersion" : 0 }

		this.services["11"] = {"ServiceIndex": 11, "ServiceType" : 11,	"ServiceVersion" : 0 }

		this.services["12"] = {"ServiceIndex": 12, "ServiceType" : 12,	"ServiceVersion" : 0 }

		this.services["13"] = {"ServiceIndex": 13, "ServiceType" : 13,	"ServiceVersion" : 0 }

		this.services["14"] = {"ServiceIndex": 14, "ServiceType" : 14,	"ServiceVersion" : 0 }

		this.services["15"] = {"ServiceIndex": 15, "ServiceType" : 15,	"ServiceVersion" : 0 }

		this.services["16"] = {"ServiceIndex": 16, "ServiceType" : 16,	"ServiceVersion" : 0 }

		this.services["17"] = {"ServiceIndex": 17, "ServiceType" : 17,	"ServiceVersion" : 0 }

		this.services["18"] = { "ServiceIndex": 18, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "0": 16, "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		
		this.services["30"] = {"ServiceIndex": 30, "ServiceType" : 17,	"ServiceVersion" : 1 }

    for (var i=1; i< 5; i++) {
      this.addNewStoredEvent(decToHex(nodeNumber, 4) + decToHex(i+600, 4));
    }
	}
}

//
// Development VLCB test module
//
module.exports.CANVLCB = class CANVLCB extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);			// Call parent class constructor
		
		this.NAME = "VLCBTEST";

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 13;								// Manufacturer Id - DEVELOPMENT
    this.parameters[2] = 97;								// Minor version number (a)
		this.parameters[3] = 10;							  // Module Id
		this.parameters[4] = 5; 								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = 25;								// Number of Node Variables
		this.parameters[7] = 1;								// Major version number
		this.parameters[8] = Flags.Consumer + Flags.Producer + Flags.FLiM + Flags.VLCB;	// Flags
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

    this.nodeVariables[1] = 0;
    this.nodeVariables[this.parameters[6]] = this.parameters[6];

		
		this.services["1"] = { "ServiceIndex": 1, "ServiceType" : 1, "ServiceVersion" : 0,
				"Diagnostics": { "0": 6, "1": 1, "2": 0, "3": 0, "4":4, "5":5, "6":6 }
		}
		
		this.services["2"] = { "ServiceIndex": 2, "ServiceType" : 2, "ServiceVersion" : 0,
				"Diagnostics": { "0": 2, "1": 254, "2": 126 }
		};
		this.services["3"] = { "ServiceIndex": 3, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "0": 17, "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		this.services["4"] = {"ServiceIndex": 4, "ServiceType" : 4,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["5"] = {"ServiceIndex": 5, "ServiceType" : 5,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["6"] = {"ServiceIndex": 6, "ServiceType" : 6,	"ServiceVersion" : 0,
				"Diagnostics": { "0": 1, "1":1 }
		}
		this.services["7"] = {"ServiceIndex": 7, "ServiceType" : 7,	"ServiceVersion" : 0 }

		this.services["8"] = {"ServiceIndex": 8, "ServiceType" : 8,	"ServiceVersion" : 0 }

		this.services["9"] = {"ServiceIndex": 9, "ServiceType" : 9,	"ServiceVersion" : 0 }

		this.services["10"] = {"ServiceIndex": 10, "ServiceType" : 10,	"ServiceVersion" : 0 }

		this.services["11"] = {"ServiceIndex": 11, "ServiceType" : 11,	"ServiceVersion" : 0 }

		this.services["12"] = {"ServiceIndex": 12, "ServiceType" : 12,	"ServiceVersion" : 0 }

		this.services["13"] = {"ServiceIndex": 13, "ServiceType" : 13,	"ServiceVersion" : 0 }

		this.services["14"] = {"ServiceIndex": 14, "ServiceType" : 14,	"ServiceVersion" : 0 }

		this.services["15"] = {"ServiceIndex": 15, "ServiceType" : 15,	"ServiceVersion" : 0 }

		this.services["16"] = {"ServiceIndex": 16, "ServiceType" : 16,	"ServiceVersion" : 0 }

		this.services["17"] = {"ServiceIndex": 17, "ServiceType" : 17,	"ServiceVersion" : 0 }

		this.services["18"] = { "ServiceIndex": 18, "ServiceType" : 3, "ServiceVersion" : 0,
				"Diagnostics": { "0": 16, "1": 1, "2": 2, "3": 3, "4":4, "5":5, "6":6, "7":7, "8":8, 
								"9":9, "10":10, "11":11, "12":12, "13":13, "14":14, "15":15, "16":16}
		}
		
		this.services["30"] = {"ServiceIndex": 30, "ServiceType" : 17,	"ServiceVersion" : 1 }

    for (var i=1; i< 4; i++) {
      this.addNewStoredEvent(decToHex(nodeNumber, 4) + decToHex(i+600, 4));
    }
    // add short
    this.addNewStoredEvent('0000' + decToHex(nodeNumber, 4));
	}
  shouldFeedback(eventIndex) { return true;}

}



