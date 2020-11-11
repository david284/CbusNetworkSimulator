'use strict';

var winston = require('winston');		// use config from root instance
const net = require('net');
var translator = require('./translateCbusMessage.js')

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
						new CANACC5 (300),
						new CANACC8 (301),
						new CANACE8C (302),
						new CANINP (303),
						new CANMIO_UNIVERSAL (304),
						]

		this.modules.forEach( function (module) {
			winston.info({message: 'CBUS Network Sim: starting CBUS module: ' + module.constructor.name});
		})

		this.server = net.createServer(function (socket) {
			this.socket=socket;
	
			socket.setKeepAlive(true,60000);
			socket.on('data', function (data) {
				winston.info({message: 'CBUS Network Sim: data received'});
				const msgArray = data.toString().split(";");
				for (var msgIndex = 0; msgIndex < msgArray.length - 1; msgIndex++) {
					var message = msgArray[msgIndex].concat(";");				// add back the ';' terminator that was lost in the split
					this.sendArray.push(message);					// store the incoming messages so the test can inspect them
					winston.info({message: 'CBUS Network Sim: <<IN [' + msgIndex + '] ' +  message + " " + translator.translateCbusMessage(message)});
					var opCode = message.substr(7, 2)
					switch (opCode) {
					case '0D':
						// QNN Format: <MjPri><MinPri=3><CANID>]<0D>
						winston.info({message: 'CBUS Network Sim: received QNN'});
						for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
							this.outputPNN(this.modules[moduleIndex].getNodeNumber());
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
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						winston.info({message: 'CBUS Network Sim: received SNN : new Node Number ' + nodeNumber});
						// could renumber or create a new module, but not necessary at this time
						this.outputNNACK(nodeNumber);
						break;
					case '50':		// RQNN sent by node
						break;
					case '51':		// NNREL sent by node
						break;
					case '52':		// NNACK sent by node
						break;
					case '53':
						// NNLRN Format: [<MjPri><MinPri=3><CANID>]<53><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received NNLRN'});
						this.learningNode = parseInt(message.substr(9, 4), 16)
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
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						if ( nodeNumber == learningNode) {
							this.getModule(nodeNumber).getStoredEvents() = [];
							winston.info({message: 'CBUS Network Sim: Node ' + nodeNumber + " events cleared"});
						}
						break;
					case '56':
						// NNEVN Format: [<MjPri><MinPri=3><CANID>]<56><NN hi><NN lo>>
						winston.info({message: 'CBUS Network Sim: received NNEVN *************************************'});
						break;
					case '57':
						// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received NERD'});
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						var events = this.getModule(nodeNumber).getStoredEvents();
						for (var i = 0; i < events.length; i++) {
							this.outputENRSP(nodeNumber, i);
						}
						break;
					case '58':
						// RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
						winston.info({message: 'CBUS Network Sim: received RQEVN'});
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						this.outputNUMEV(nodeNumber);
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
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						var variableIndex = parseInt(message.substr(13, 2), 16)
						this.outputNVANS(nodeNumber, variableIndex);
						break;
					case '73':
						// RQNPN Format: [<MjPri><MinPri=3><CANID>]<73><NN hi><NN lo><Para#>
						winston.info({message: 'CBUS Network Sim: received RQNPN'});
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						var parameterIndex = parseInt(message.substr(13, 2), 16)
						this.outputPARAN(nodeNumber, parameterIndex);
						break;
					case '90':
						// ACON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received ACON'});
						var eventName = parseInt(message.substr(9, 8), 16)					// node number + event number
						this.processAccessoryEvent("ACON", eventName);
						break;
					case '91':
						// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received ACOF'});
						var eventName = parseInt(message.substr(9, 8), 16)					// node number + event number
						this.processAccessoryEvent("ACOF", eventName);
						break;
					case '95':
						// EVULN Format: [<MjPri><MinPri=3><CANID>]<95><NN hi><NN lo><EN hi><EN lo>
						winston.info({message: 'CBUS Network Sim: received EVULN'});
						var eventName = parseInt(message.substr(9, 8), 16)					// node number + event number
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							this.deleteEventByName(this.learningNode, eventName);
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' deleted eventName ' + eventName});
						} else {
							winston.info({message: 'CBUS Network Sim: EVULN - not in learn mode'});
						}
						break;
					case '96':
						// NVSET Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
						winston.info({message: 'CBUS Network Sim: received NVSET'});
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						var variableIndex = parseInt(message.substr(13, 2), 16)
						var value = parseInt(message.substr(15, 2), 16)
						var variables = this.getModule(nodeNumber).getVariables();
						if (variableIndex < variables.length) {
							variables[variableIndex] = value;
							winston.info({message: 'CBUS Network Sim: NVSET Nove variable ' + variableIndex + ' set to ' + value});
							this.outputWRACK(nodeNumber);
						}
						else {
							winston.info({message: 'CBUS Network Sim:  ************ NVSET variable index exceeded ************'});
							this.outputCMDERR(nodeNumber, 10);
						}
						break;
					case '98':
						// ASON Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DD hi><DD lo>
						winston.info({message: 'CBUS Network Sim: received ASON'});
						var deviceNumber = parseInt(message.substr(13, 4), 16)					// only device number
						this.processAccessoryEvent("ASON", deviceNumber);
						break;
					case '99':
						// ASOF Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DD hi><DD lo>
						winston.info({message: 'CBUS Network Sim: received ASOF'});
						var deviceNumber = parseInt(message.substr(13, 4), 16)					// only device number
						this.processAccessoryEvent("ASOF", deviceNumber);
						break;
					case '9C':
						// REVAL Format: [<MjPri><MinPri=3><CANID>]<9C><NN hi><NN lo><EN#><EV#>
						winston.info({message: 'CBUS Network Sim: received REVAL'});
						var nodeNumber = parseInt(message.substr(9, 4), 16)
						var eventIndex = parseInt(message.substr(13, 2), 16)
						var eventVariableIndex = parseInt(message.substr(15, 2), 16)
						this.outputNEVAL(nodeNumber, eventIndex, eventVariableIndex)
						break;
					case 'D2':
						// EVLRN Format: [<MjPri><MinPri=3><CANID>]<D2><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
						winston.info({message: 'CBUS Network Sim: received EVLRN'});
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							var eventName = parseInt(message.substr(9, 8), 16)				// node number + event number
							var eventVariableIndex = parseInt(message.substr(17, 2), 16)
							var value = parseInt(message.substr(19, 2), 16)
							var event = this.getEventByName(this.learningNode, eventName);
							event.variables[eventVariableIndex] = value;
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' eventName ' + eventName + 
													' taught EV ' + eventVariableIndex + ' = ' + value});
							this.outputWRACK(this.learningNode);
						} else {
							winston.info({message: 'CBUS Network Sim: EVLRN - not in learn mode'});
							this.outputCMDERR(0, 2); // not striclty correct, as we don't know which module ought to be in learn mode, hence zero
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

	getCanHeader(nodeNumber) {
		// format [<MjPri><MinPri><ID>]
		// MjPri - bits 14 & 15
		// MinPri - bits 12 & 13
		// ID - bits 5 to 11 - generate a unique CAN Id from it's position in the Module array (+1 to avoid zero)
		// bits 0 to 4 
		var MjPri = 1;
		var MinPri = 2;
		var canId = this.getModuleIndex(nodeNumber) + 1;
		var canHeader = (MjPri << 14) + (MinPri << 12) + (canId << 5) 
		return decToHex(canHeader, 4);
	}


	getModule(nodeNumber) {
		for (var i = 0; i < this.modules.length; i++) {
			if (this.modules[i].getNodeNumber() == nodeNumber) return this.modules[i];
		}
	}

	getModuleIndex(nodeNumber) {
		for (var i = 0; i < this.modules.length; i++) {
			if (this.modules[i].getNodeNumber() == nodeNumber) return i;
		}
	}

	getEventByName(nodeNumber, eventName) {
		var events = this.getModule(nodeNumber).getStoredEvents();
		for (var eventIndex = 0; eventIndex < events.length; eventIndex++) {
			if (events[eventIndex].eventName == eventName) return events[eventIndex];
		}
		// if we get here then event doesn't yet exist, so create it
		return this.getModule(nodeNumber).addNewEvent(eventName);
	}

	deleteEventByName(nodeNumber, eventName) {
		var events = this.getModule(nodeNumber).getStoredEvents();
		var eventIndex;
		// look for matching eventName in array
		for (var index = 0; index < events.length; index++) {
			if (events[index].eventName == eventName) {
				eventIndex = index;
				break;
			}
		}
		// if a matching eventName was found, then remove entry from array
		if (eventIndex != undefined) { events.splice(eventIndex, 1) }
	}

	processAccessoryEvent(opCode, eventName) {
		// check each module to see if they have a matching event
		for (var i = 0; i < this.modules.length; i++) {
			var events = this.modules[i].getStoredEvents();
			var nodeNumber = this.modules[i].getNodeNumber();
			// look for matching eventName in array
			for (var index = 0; index < events.length; index++) {
				if (events[index].eventName == eventName) {
					// now check if we should send a feedback response
					if (this.modules[i].shouldFeedback(index)) {
						var eventNumber = eventName % 0x10000;
						winston.info({message: 'CBUS Network Sim: Feedback ' + nodeNumber + " event " + eventNumber});
						if (opCode == "ACON") {this.outputACON(nodeNumber, eventNumber)}
						if (opCode == "ACOF") {this.outputACOF(nodeNumber, eventNumber)}
						if (opCode == "ASON") {this.outputASON(nodeNumber, eventNumber)}
						if (opCode == "ASOF") {this.outputASOF(nodeNumber, eventNumber)}
					}
				}
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
	 outputRQNN(nodeNumber) {
		//Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '50' + decToHex(nodeNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}
	

	// 52
	 outputNNACK(nodeNumber) {
		//NNACK Format: [<MjPri><MinPri=3><CANID>]<52><NN hi><NN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '52' + decToHex(nodeNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}
	

	// 59
	 outputWRACK(nodeNumber) {
		//WRACK Format: [<MjPri><MinPri=3><CANID>]<59><NN hi><NN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '59' + decToHex(nodeNumber, 4) + ';';
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
	 outputCMDERR(nodeNumber, errorNumber) {
		// Format: [<MjPri><MinPri=3><CANID>]<6F><NN hi><NN lo><Error number>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '6F' + decToHex(nodeNumber, 4) + decToHex(errorNumber, 2) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 74
	 outputNUMEV(nodeNumber) {
		// Format: [<MjPri><MinPri=3><CANID>]<74><NN hi><NN lo><No.of events>
		var storedEventsCount = this.getModule(nodeNumber).getStoredEventsCount();
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '74' + decToHex(nodeNumber, 4) + decToHex(storedEventsCount, 2) + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}

	// 90
	 outputACON(nodeNumber, eventId) {
		// ASON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '90' + decToHex(nodeNumber, 4) + decToHex(eventId, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 91
	 outputACOF(nodeNumber, eventId) {
		// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '91' + decToHex(nodeNumber, 4) + decToHex(eventId, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 98
	 outputASON(nodeNumber, deviceNumber) {
		// ASON Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DD hi><DD lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '98' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 99
	 outputASOF(nodeNumber, deviceNumber) {
		// ASOF Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DD hi><DD lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '99' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}


	// 97
	 outputNVANS(nodeNumber, variableIndex) {
		// NVANS Format: [<MjPri><MinPri=3><CANID>]<97><NN hi><NN lo><NV# ><NV val>
		var variables = this.getModule(nodeNumber).getVariables();
		if (variableIndex < variables.length) {
			var value = variables[variableIndex];
			var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '97' + decToHex(nodeNumber, 4) + decToHex(variableIndex, 2) + decToHex(value, 2) + ';'
			this.socket.write(msgData);
			winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		}
		else
			winston.info({message: 'CBUS Network Sim:  ************ NVANS variable index exceeded ************'});
	 }

	// 9B
	 outputPARAN(nodeNumber, paramId) {
		// Format: [<MjPri><MinPri=3><CANID>]<9B><NN hi><NN lo><Para#><Para val>
		if (paramId <= this.getModule(nodeNumber).getParameter(0)) {
			var paramValue = this.getModule(nodeNumber).getParameter(paramId);
			var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + '9B' + decToHex(nodeNumber, 4) + decToHex(paramId, 2) + decToHex(paramValue, 2) + ';'
			winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
			this.socket.write(msgData);
		}
	}
	
	// B5
	outputNEVAL(nodeNumber, eventIndex, eventVariableIndex) {
		// NEVAL Format: [<MjPri><MinPri=3><CANID>]<B5><NN hi><NN lo><EN#><EV#><EVval>
		var events = this.getModule(nodeNumber).getStoredEvents();
		var value = events[eventIndex].variables[eventVariableIndex];
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + 'B5' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + decToHex(value, 2) +';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}
	
	// B6
	 outputPNN(nodeNumber) {
		// PNN Format: <0xB6><<NN Hi><NN Lo><Manuf Id><Module Id><Flags>
		var nodeData = this.getModule(nodeNumber).getNodeNumberHex()
			+ this.getModule(nodeNumber).getManufacturerIdHex() 
			+ this.getModule(nodeNumber).getModuleIdHex() 
			+ this.getModule(nodeNumber).getFlagsHex();
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + 'B6' + nodeData + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}
	
	//F2
	outputENRSP(nodeNumber, eventIndex) {
		// ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
		var events = this.getModule(nodeNumber).getStoredEvents();
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + 'F2' + decToHex(nodeNumber, 4) + decToHex(events[eventIndex].eventName, 8) + decToHex(eventIndex, 2) + ';'
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
		this.socket.write(msgData);
	}


	// FC
	 outputUNSUPOPCODE(nodeNumber) {
		// Ficticious opcode - 'FC' currently unused
		// Format: [<MjPri><MinPri=3><CANID>]<FC><NN hi><NN lo>
		var msgData = ':S' + this.getCanHeader(nodeNumber) + 'N' + 'FC' + decToHex(nodeNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + translator.translateCbusMessage(msgData)});
	}
}

class CbusModule {
	constructor(nodeNumber) {
		this.events = []
		this.CanId = 0;
		this.nodeNumber = nodeNumber;
		this.parameters = 	[];
		// prefill parameters array to 21 elements to match dev guide 6c & put length in element 0 (not including 0)
		for (var i = 0; i < 21 ; i++) {
			this.parameters.push(0);
		}
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
			
		this.variables = [];
	}
	
	// CAN Id
	getCanId() { return this.CanId; }
	setCanId(canId) { this.CanId = canId; }
	
	// Flags
	getFlagsHex() {return decToHex(this.parameters[8], 2)}
	
	// Events
	addNewEvent(eventName) {
		var variables = [];
		// create variable array of correct length for specific module
		for (var index = 0; index <= this.parameters[5]; index++) {variables.push(0)};
		this.events.push({'eventName': eventName, "variables": variables});
		return this.events[this.events.length - 1];		// adjust as array is zero based		
	}
	getStoredEvents() { return this.events}
	getStoredEventsCount() { return this.events.length}
	
	// Feedback
	shouldFeedback() { return false;}

	// Node Number
	getNodeNumber(){return this.nodeNumber}
	getNodeNumberHex(){return decToHex(this.nodeNumber, 4)}
	setnodeNumber(newnodeNumber) { this.nodeNumber = newnodeNumber;}
	
	// Module Id
	getModuleIdHex() {return decToHex(this.parameters[3], 2)}

	// Manufacturer Id
	getManufacturerIdHex() {return decToHex(this.parameters[1], 2)}

	// Parameters
	getParameter(i) {return this.parameters[i]}
	
	// Variables
	getVariables() { return this.variables}
}

class CANACC5 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);
		this.variables.push( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ); 		// node variables + 1 (zero index)
			//NV1-8 channel variables
			//NV9 is feedback delay. In 0.5mSec intervals approx.
			//NV10 startup position. Bit set is OFF end, bit  clear is now go to last saved position
			//NV11 is move on startup. Bit set is move.
			//NV12 not used yet
		
		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 2;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// Number of Node Variables
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 0xD;								// Flags - not a producer
		this.parameters[9] = 1;									// CPU type
		this.parameters[10] = 1;								// interface type
																// skip 11 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		this.events.push({'eventName': 0x012D0103, "variables":[ 0, 0, 0, 0 ]})
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

class CANACC8 extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);
		this.variables.push( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ); 		// node variables + 1 (zero index)
			//NV1-8 channel variables
			//NV9 is feedback delay. In 0.5mSec intervals approx.
			//NV10 startup position. Bit set is OFF end, bit  clear is now go to last saved position
			//NV11 is move on startup. Bit set is move.
			//NV12 not used yet

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 3;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 3;									// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// remove zero index
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 0xD;								// Flags - not a producer
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		this.events.push({'eventName': 0x012D0103, "variables":[ 0, 0, 0, 0 ]})
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

class CANSERVO8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 19;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}
}

class CANMIO_UNIVERSAL extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		// prefill variables array to 127 (plus zero)
		for (var i = 0; i < 128 ; i++) {this.variables.push(0);}

		// increase parameters array to 31 (plus zero)
		while(this.parameters.length < 32) {this.parameters.push(0);}

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "a".charCodeAt(0);					// Minor version number
		this.parameters[3] = 32;								// Module Id
		this.parameters[4] = 254;								// Number of supported events
		this.parameters[5] = 20;								// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// Number of Node Variables
		this.parameters[7] = 3;									// Major version number
		this.parameters[8] = 0xF;								// Flags - producer/consumer
		this.parameters[9] = 1;									// CPU type
		this.parameters[10] = 1;								// interface type
																// skip 11 to 18
		this.parameters[19] = 1;								// Code for CPU manufacturer 
		this.parameters[20] = 0;								// Beta version number - 0 if production
		
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}
}

class CANCAB extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 8;									// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

class CANPAN extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 29;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

class CANCMD extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 10;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)
	}
}

class CANACE8C extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);
		this.variables.push( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ); 	// 9 node variables + 1 (zero index)

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "q".charCodeAt(0);					// Minor version number
		this.parameters[3] = 5;									// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// remove zero index
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 14;								// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		this.events.push({'eventName': 0x012D0103, "variables":[ 0, 0, 0, 0 ]})
	}
}

class CANINP extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);
		this.variables.push( 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ); 	// 9 node variables + 1 (zero index)

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[2] = "u".charCodeAt(0);					// Minor version number
		this.parameters[3] = 62;								// Module Id
		this.parameters[4] = 32;								// Number of supported events
		this.parameters[5] = 2;									// Number of event variables
		this.parameters[6] = this.variables.length - 1;			// remove zero index
		this.parameters[7] = 2;									// Major version number
		this.parameters[8] = 14;								// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

		this.events.push({'eventName': 0x012D0103, "variables":[ 0, 0, 0, 0 ]})
	}
}

class CANMIO_OUT extends CbusModule{
	constructor(nodeNumber) {
		super(nodeNumber);

		this.parameters[1] = 165;								// Manufacturer Id - MERG
		this.parameters[3] = 52;								// Module Id
		this.parameters[8] = 7;									// Flags
		this.parameters[0] = this.parameters.length - 1;		// Number of parameters (not including 0)

	}

}



module.exports = {
    mock_CbusNetwork: mock_CbusNetwork
}




