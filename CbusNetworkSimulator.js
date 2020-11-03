'use strict';

var winston = require('winston');		// use config from root instance
const net = require('net');
const cbusMessage = require('./merg/mergCbusMessage.js')
var translator = require('./merg/translateCbusMessage.js')

//
//		Grid connect CAN over serial message syntax
//     : <S | X> <IDENTIFIER> <N> <DATA-0> <DATA-1> … <DATA-7> ;
//
//	

function pad(num, len) { //add zero's to ensure hex values have correct number of characters
    var padded = "00000000" + num;
    return padded.substr(-len);
}


function decToHex(num, len) {
    let  output = Number(num).toString(16).toUpperCase()
    var padded = "00000000" +  output
    //return (num + Math.pow(16, len)).toString(16).slice(-len).toUpperCase()
    return padded.substr(-len)
}


class mock_CbusNetwork {

    constructor(NET_PORT) {
		winston.info({message: 'CBUS Network Sim: Starting'});


		this.sendArray = [];
		this.socket;
		this.learningNode;
		
		this.modules = 	[
//						new CANACC8 (1),
						new CANACC5 (2),
						]

		this.server = net.createServer(function (socket) {
			this.socket=socket;
	
			socket.setKeepAlive(true,60000);
			socket.on('data', function (data) {
				winston.info({message: 'CBUS Network Sim: data received'});
				const msgArray = data.toString().split(";");
				for (var msgIndex = 0; msgIndex < msgArray.length - 1; msgIndex++) {
					msgArray[msgIndex] = msgArray[msgIndex].concat(";");				// add back the ';' terminator that was lost in the split
					this.sendArray.push(msgArray[msgIndex]);					// store the incoming messages so the test can inspect them
					let msg = new cbusMessage.cbusMessage(msgArray[msgIndex]);
					winston.info({message: 'CBUS Network Sim: <<IN [' + msgIndex + '] ' +  msgArray[msgIndex] + " " + msg.translateMessage()});
					switch (msg.opCode()) {
					case '0D':
						// QNN Format: <MjPri><MinPri=3><CANID>]<0D>
						winston.info({message: 'CBUS Network Sim: received QNN'});
						for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
							this.outputPNN(this.modules[moduleIndex].getNodeId());
						}
						break;
					case '10':
						// RQNP Format: <MjPri><MinPri=3><CANID>]<10>
						winston.info({message: 'CBUS Network Sim: received RQNP *************************************'});
						break;
					case '11':
						// RQMN Format: <MjPri><MinPri=3><CANID>]<11>
						winston.info({message: 'CBUS Network Sim: received RQMN *************************************'});
						break;
					case '42':
						// SNN Format: [<MjPri><MinPri=3><CANID>]<42><NNHigh><NNLow>
						var nodeNumber = msg.nodeId();
						winston.info({message: 'CBUS Network Sim: received SNN : new Node Number ' + nodeNumber});
						// could renumber or create a new module, but not necessary at this time
						break;
					case '50':
						// RQNN Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received RQNN *************************************'});
						break;
					case '51':		// sent by node
						break;
					case '52':		// sent by node
						break;
					case '53':
						// NNLRN Format: [<MjPri><MinPri=3><CANID>]<53><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received NNLRN'});
						this.learningNode = msg.nodeId();
						winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' put into learn mode' });
						break;
					case '54':
						// NNULN Format: [<MjPri><MinPri=3><CANID>]<54><NN hi><NN lo>>
						winston.info({message: 'CBUS Network Sim: received NNULN'});
						this.learningNode = undefined;
						winston.info({message: 'CBUS Network Sim: learn mode cancelled' });
						break;
					case '55':
						// NNCLR Format: [<MjPri><MinPri=3><CANID>]<55><NN hi><NN lo>>
						winston.info({message: 'CBUS Network Sim: received NNCLR'});
						if ( msg.nodeId() == learningNode) {
							this.getModule(msg.nodeId()).getStoredEvents() = [];
							winston.info({message: 'CBUS Network Sim: Node ' + msg.nodeId() + " events cleared"});
						}
						break;
					case '56':
						// NNEVN Format: [<MjPri><MinPri=3><CANID>]<56><NN hi><NN lo>>
						winston.info({message: 'CBUS Network Sim: received NNEVN *************************************'});
						break;
					case '57':
						// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received NERD'});
						var events = this.getModule(msg.nodeId()).getStoredEvents();
						for (var i = 0; i < events.length; i++) {
							this. outputENRSP(msg.nodeId(), i);
						}
						break;
					case '58':
						// RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received RQEVN'});
						this. outputNUMEV(msg.nodeId());
						break;
					case '59':		// WRACK - sent by node
						break;
					case '5C':
						// BOOTM Format: [<MjPri><MinPri=3><CANID>]<5C><NN hi><NN lo>>
						winston.info({message: 'CBUS Network Sim: received BOOTM *************************************'});
						break;
					case '6F':		// CMDERR - sent by node
						break;
					case '71':
						// NVRD Format: [<MjPri><MinPri=3><CANID>]<71><NN hi><NN lo><NV#>
						winston.info({message: 'CBUS Network Sim: received NVRD'});
						var variableIndex = parseInt(msg.messageOutput().substr(13, 2), 16)
						this.outputNVANS(msg.nodeId(), variableIndex);
						break;
					case '73':
						// RQNPN Format: [<MjPri><MinPri=3><CANID>]<73><NN hi><NN lo><Para#>
						winston.info({message: 'CBUS Network Sim: received RQNPN'});
						this. outputPARAN(msg.nodeId(), msg.paramId());
						break;
					case '90':
						// ACON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received ACON'});
						break;
					case '91':
						// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received ACOF'});
						break;
					case '95':
						// EVULN Format: [<MjPri><MinPri=3><CANID>]<95><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received EVULN'});
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							var eventName = parseInt(msg.messageOutput().substr(9, 8), 16)				// node number + event number
							this.deleteEventByName(this.learningNode, eventName);
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' deleted eventName ' + eventName});
						} else {
							winston.info({message: 'CBUS Network Sim: EVULN - not in learn mode'});
						}
						break;
					case '96':
						// NVSET Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
						winston.info({message: 'CBUS Network Sim: received NVSET'});
						var variableIndex = parseInt(msg.messageOutput().substr(13, 2), 16)
						var value = parseInt(msg.messageOutput().substr(15, 2), 16)
						var variables = this.getModule(msg.nodeId()).getVariables();
						if (variableIndex < variables.length) {
							variables[variableIndex] = value;
							winston.info({message: 'CBUS Network Sim: NVSET Nove variable ' + variableIndex + ' set to ' + value});
						}
						else
							winston.info({message: 'CBUS Network Sim:  ************ NVSET variable index exceeded ************'});
						break;
					case '9C':
						// REVAL Format: [<MjPri><MinPri=3><CANID>]<9C><NN hi><NN lo><EN#><EV#>
						winston.info({message: 'CBUS Network Sim: received REVAL'});
						var nodeId = msg.nodeId();
						var eventIndex = parseInt(msg.messageOutput().substr(13, 2), 16)
						var eventVariableIndex = parseInt(msg.messageOutput().substr(15, 2), 16)
						this.outputNEVAL(nodeId, eventIndex, eventVariableIndex)
						break;
					case 'D2':
						// EVLRN Format: [<MjPri><MinPri=3><CANID>]<D2><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
						winston.info({message: 'CBUS Network Sim: received EVLRN'});
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							var eventName = parseInt(msg.messageOutput().substr(9, 8), 16)				// node number + event number
							var eventVariableIndex = parseInt(msg.messageOutput().substr(17, 2), 16)
							var value = parseInt(msg.messageOutput().substr(19, 2), 16)
							var event = this.getEventByName(this.learningNode, eventName);
							event.variables[eventVariableIndex] = value;
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' eventName ' + eventName + 
													' taught EV ' + eventVariableIndex + ' = ' + value});
						} else {
							winston.info({message: 'CBUS Network Sim: EVLRN - not in learn mode'});
						}
						break;
					default:
						winston.info({message: 'CBUS Network Sim: *************************** received unknown opcode '});
						break;
					}
				}
			}.bind(this));

			socket.on('end', function () {
				winston.info({message: 'CBUS Network Sim: Client Disconnected'});
			}.bind(this));
			
			socket.on('error', function(err) {
				winston.info({message: 'CBUS Network Sim: Socket error ' + err});
			}.bind(this));
			
		}.bind(this));

		this.server.listen(NET_PORT);
		
		// emitted when new client connects
		this.server.on('connection',function(socket){
			var rport = socket.remotePort;
			winston.info({message: 'CBUS Network Sim: remote client at port : ' + rport});
		});
	}


	getSendArray() {
		return this.sendArray;
	}

	
	clearSendArray() {
		this.sendArray = [];
	}


	stopServer() {
		this.server.close();
		this.socket.end();
		winston.info({message: 'CBUS Network Sim: Server closed'});
	}


	getModule(nodeId) {
		for (var i = 0; i < this.modules.length; i++) {
			if (this.modules[i].getNodeId() == nodeId) return this.modules[i];
		}
	}

	getEventByName(nodeId, eventName) {
		var events = this.getModule(nodeId).getStoredEvents();
		for (var eventIndex = 0; eventIndex < events.length; eventIndex++) {
			if (events[eventIndex].eventName == eventName) return events[eventIndex];
		}
		// if we get here then event doesn't yet exist, so create it
		events.push({'eventName': eventName, "variables":[ 1, 2, 3 ]});
		return events[events.length - 1];		// adjust as array is zero based
	}

	deleteEventByName(nodeId, eventName) {
		var events = this.getModule(nodeId).getStoredEvents();
		var eventIndex;
		for (var index = 0; index < events.length; index++) {
			if (events[index].eventName == eventName) {
				eventIndex = index;
				break;
			}
		}
		if (eventIndex != undefined) {
			if (eventIndex >= events.length - 1) {
				events.pop();
			}
			else {
				events.splice(eventIndex, 1)
			}
		}
	}

	// 21
	 outputKLOC(session) {
		// Format: [<MjPri><MinPri=2><CANID>]<21><Session>
		var msgData = ':S' + 'B780' + 'N' + '21' + decToHex(session, 2) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 50
	 outputRQNN(nodeId) {
		//Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
		var msgData = ':S' + 'B780' + 'N' + '50' + decToHex(nodeId, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}
	

	// 60
	 outputDFUN(session, fn1, fn2) {
		// Format: [<MjPri><MinPri=2><CANID>]<60><Session><Fn1><Fn2>
		var msgData = ':S' + 'B780' + 'N' + '60' + decToHex(session, 2) + decToHex(fn1, 2) + decToHex(fn2, 2) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 63
	 outputERR(data, errorNumber) {
		// Format: [<MjPri><MinPri=2><CANID>]<63><Dat 1><Dat 2><Dat 3>
		var msgData = ':S' + 'B780' + 'N' + '63' + decToHex(data, 4) + decToHex(errorNumber, 2) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 6F
	 outputCMDERR(nodeId, errorNumber) {
		// Format: [<MjPri><MinPri=3><CANID>]<6F><NN hi><NN lo><Error number>
		var msgData = ':S' + 'B780' + 'N' + '6F' + decToHex(nodeId, 4) + decToHex(errorNumber, 2) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 74
	 outputNUMEV(nodeId) {
		// Format: [<MjPri><MinPri=3><CANID>]<74><NN hi><NN lo><No.of events>
		var storedEventsCount = this.getModule(nodeId).getStoredEventsCount();
		var msgData = ':S' + 'B780' + 'N' + '74' + decToHex(nodeId, 4) + decToHex(storedEventsCount, 2) + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}

	// 90
	 outputACON(nodeId, eventId) {
		// Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
		var msgData = ':S' + 'B780' + 'N' + '90' + decToHex(nodeId, 4) + decToHex(eventId, 4) + this.getModule(nodeId) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 91
	 outputACOF(nodeId, eventId) {
		// Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
		var msgData = ':S' + 'B780' + 'N' + '91' + decToHex(nodeId, 4) + decToHex(eventId, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 97
	 outputNVANS(nodeId, variableIndex) {
		// NVANS Format: [<MjPri><MinPri=3><CANID>]<97><NN hi><NN lo><NV# ><NV val>
		var variables = this.getModule(nodeId).getVariables();
		if (variableIndex < variables.length) {
			var value = variables[variableIndex];
			var msgData = ':S' + 'B780' + 'N' + '97' + decToHex(nodeId, 4) + decToHex(variableIndex, 2) + decToHex(value, 2) + ';'
			this.socket.write(msgData);
			winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		}
		else
			winston.info({message: 'CBUS Network Sim:  ************ NVANS variable index exceeded ************'});
	 }

	// 9B
	 outputPARAN(nodeId, paramId) {
		// Format: [<MjPri><MinPri=3><CANID>]<9B><NN hi><NN lo><Para#><Para val>
		if (paramId <= this.getModule(nodeId).getParameter(0)) {
			var paramValue = this.getModule(nodeId).getParameter(paramId);
			var msgData = ':S' + 'B780' + 'N' + '9B' + decToHex(nodeId, 4) + decToHex(paramId, 2) + decToHex(paramValue, 2) + ';'
			winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
			this.socket.write(msgData);
		}
	}
	
	// B5
	outputNEVAL(nodeId, eventIndex, eventVariableIndex) {
		// NEVAL Format: [<MjPri><MinPri=3><CANID>]<B5><NN hi><NN lo><EN#><EV#><EVval>
		var events = this.getModule(nodeId).getStoredEvents();
		var value = events[eventIndex].variables[eventVariableIndex];
		var msgData = ':S' + 'B780' + 'N' + 'B5' + decToHex(nodeId, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + decToHex(value, 2) +';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}
	
	// B6
	 outputPNN(nodeId) {
		// PNN Format: <0xB6><<NN Hi><NN Lo><Manuf Id><Module Id><Flags>
		var nodeData = this.getModule(nodeId).getNodeIdHex()
			+ this.getModule(nodeId).getManufacturerIdHex() 
			+ this.getModule(nodeId).getModuleIdHex() 
			+ this.getModule(nodeId).getFlagsHex();
		var msgData = ':S' + 'B780' + 'N' + 'B6' + nodeData + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}
	
	//F2
	outputENRSP(nodeId, eventIndex) {
		// ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
		var events = this.getModule(nodeId).getStoredEvents();
		var msgData = ':S' + 'B780' + 'N' + 'F2' + decToHex(nodeId, 4) + decToHex(events[eventIndex].eventName, 8) + decToHex(eventIndex, 2) + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}


	// FC
	 outputUNSUPOPCODE(nodeId) {
		// Ficticious opcode - 'FC' currently unused
		// Format: [<MjPri><MinPri=3><CANID>]<FC><NN hi><NN lo>
		var msgData = ':S' + 'B780' + 'N' + 'FC' + decToHex(nodeId, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}
}

class CbusModule {
	constructor(nodeId) {
		this.nodeId = nodeId;
		this.parameters = 	[ 	8,		// number of available parameters
								0,		// param 1 manufacturer Id
								0,		// param 2 Minor code version
								0,		// param 3 module Id
								0,		// param 4 number of supported events
								0,		// param 5 number of event variables
								0,		// param 6 number of supported node variables
								0,		// param 7 major version
								0,		// param 8 node flags
								// NODE flags
								// 	Bit 0	: Consumer
								//	Bit 1	: Producer
								//	Bit 2	: FLiM Mode
								//	Bit 3	: The module supports bootloading		
							]
		this.variables = [];					
		this.events = []
	}

	getStoredEvents() { return this.events}
	getStoredEventsCount() { return this.events.length}
	
	getVariables() { return this.variables}
	
	getParameter(i) {return this.parameters[i]}
	
	getNodeId(){return this.nodeId}
	getNodeIdHex(){return decToHex(this.nodeId, 4)}
	setNodeId(newNodeId) { this.nodeId = newNodeId;}
	
	getModuleIdHex() {return decToHex(this.parameters[3], 2)}
	setModuleId(Id) {this.parameters[3] = Id}

	getManufacturerIdHex() {return decToHex(this.parameters[1], 2)}
	setManufacturerId(Id) {this.parameters[1] = Id}

	getFlagsHex() {return decToHex(this.parameters[8], 2)}
	setNodeFlags(flags) {this.parameters[8] = flags}
}

class CANACC5 extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(2);
		this.setManufacturerId(165);							// MERG
		this.setNodeFlags(0xD);									// not a producer
		this.variables.push( 0, 1, 2, 3, 4, 5, 6, 7, 8 ); 		// 8 node variables + 1 (zero index)
		
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// remove zero index
		
		this.events.push({'eventName': 0x01020103, "variables":[ 1, 2, 3 ]})
		this.events.push({'eventName': 0x01020104, "variables":[ 1, 2, 3 ]})
		this.events.push({'eventName': 0x01020105, "variables":[ 1, 2, 3 ]})
	}
}

class CANACC8 extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(3);
		this.setManufacturerId(165);
		this.setNodeFlags(0xD);			// not a producer
		this.parameters[4] = 32;		// Number of supported events
		this.parameters[5] = 2;			// Number of event variables
		this.parameters[6] = 0;			// zero node variables
		for (var i = 0; i < 32; i++) { this.events.push(i)}
	}
}

class CANSERVO8C extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(19);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANMIO extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(32);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANCAB extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(9);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANPAN extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(29);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANCMD extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(10);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANACE8C extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.setModuleId(5);
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}

class CANMIO_OUT extends CbusModule{
	constructor(nodeId) {
		super(nodeId);
		this.parameters[3] = 52;
		this.setManufacturerId(165);
		this.setNodeFlags(7);
	}
}



module.exports = {
    mock_CbusNetwork: mock_CbusNetwork
}




