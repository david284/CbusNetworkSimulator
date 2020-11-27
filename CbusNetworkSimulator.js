'use strict';

var winston = require('winston');		// use config from root instance
const net = require('net');
var translator = require('./translateCbusMessage.js')
var cbusLib = require('./cbusLibrary.js')

//
//		Grid connect CAN over serial message syntax
//     : <S | X> <IDENTIFIER> <N> <DATA-0> <DATA-1> … <DATA-7> ;
//
//	

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

class cbusNetworkSimulator {

    constructor(NET_PORT, suppliedModules) {
		winston.info({message: 'CBUS Network Sim: Starting'});
        
        this.modules = suppliedModules;

		this.sendArray = [];
		this.socket;
		this.learningNode;
		
/* 		this.modules = 	[
						new CANACC5 (0),
						new CANACC8 (1),
						new CANACE8C (302),
						new CANINP (303),
						new CANMIO_UNIVERSAL (65535),
						]
 */
 
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
                    var cbusMsg = cbusLib.decode(message)      // decode into cbus message
					winston.info({message: 'CBUS Network Sim: <<< IN [' + msgIndex + '] ' +  message + " <<< " + cbusMsg.text});
					switch (cbusMsg.opCode) {
					case '0D': //QNN
						for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
							this.outputPNN(this.modules[moduleIndex].getNodeNumber());
						}
						break;
					case '10': // RQNP
						break;
					case '11': // RQMN
						break;
					case '42': // SNN
						// could renumber or create a new module, but not necessary at this time
						this.outputNNACK(cbusMsg.nodeNumber);
						break;
					case '50': // RQNN sent by node
						break;
					case '51': // NNREL sent by node
						break;
					case '52': // NNACK sent by node
						break;
					case '53': // NNLRN
						this.learningNode = cbusMsg.nodeNumber
						winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' put into learn mode' });
						break;
					case '54': // NNULN
						this.learningNode = undefined;
						winston.info({message: 'CBUS Network Sim: learn mode cancelled' });
						break;
					case '55': // NNCLR
						var nodeNumber = cbusMsg.nodeNumber
						if ( nodeNumber == this.learningNode) {
							this.getModule(nodeNumber).getStoredEvents() = [];
							winston.info({message: 'CBUS Network Sim: Node ' + nodeNumber + " events cleared"});
						}
						break;
					case '57': // NERD
						var nodeNumber = cbusMsg.nodeNumber
						var events = this.getModule(nodeNumber).getStoredEvents();
						for (var i = 0; i < events.length; i++) {
							this.outputENRSP(nodeNumber, i);
						}
						break;
					case '58': // RQEVN
						var nodeNumber = cbusMsg.nodeNumber
						this.outputNUMEV(nodeNumber);
						break;
					case '59': // WRACK - sent by node
						break;
					case '6F': // CMDERR - sent by node
						break;
					case '71': // NVRD
						this.outputNVANS(cbusMsg.nodeNumber, cbusMsg.nodeVariableIndex);
						break;
					case '73': // RQNPN
						this.outputPARAN(cbusMsg.nodeNumber, cbusMsg.ParameterIndex);
						break;
					case '90': // ACON
						this.processAccessoryEvent("ACON", cbusMsg.nodeNumber, cbusMsg.eventNumber);
						break;
					case '91': // ACOF
						this.processAccessoryEvent("ACOF", cbusMsg.nodeNumber, cbusMsg.eventNumber);
						break;
					case '95': // EVULN
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							this.deleteEventByName(this.learningNode, cbusMsg.eventName);
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' deleted eventName ' + cbusMsg.eventName});
						} else {
							winston.info({message: 'CBUS Network Sim: EVULN - not in learn mode'});
						}
						break;
					case '96': // NVSET
						var variables = this.getModule(cbusMsg.nodeNumber).getVariables();
						if (cbusMsg.nodeVariableIndex < variables.length) {
							variables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue;
							winston.info({message: 'CBUS Network Sim: NVSET Nove variable ' + cbusMsg.nodeVariableIndex + ' set to ' + cbusMsg.nodeVariableValue});
							this.outputWRACK(cbusMsg.nodeNumber);
						}
						else {
							winston.info({message: 'CBUS Network Sim:  ************ NVSET variable index exceeded ************'});
							this.outputCMDERR(nodeNumber, 10);
						}
						break;
					case '98': // ASON
						this.processAccessoryEvent("ASON", 0, cbusMsg.deviceNumber);
						break;
					case '99': // ASOF
						this.processAccessoryEvent("ASOF", 0, cbusMsg.deviceNumber);
						break;
					case '9C': // REVAL
						this.outputNEVAL(cbusMsg.nodeNumber, cbusMsg.eventIndex, cbusMsg.eventVariableIndex)
						break;
					case 'D2': // EVLRN
						if (this.learningNode != undefined) {
							// Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
							var event = this.getEventByName(this.learningNode, cbusMsg.eventName);
							event.variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue;
							winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' eventName ' + cbusMsg.eventName + 
								' taught EV ' + cbusMsg.eventVariableIndex + ' = ' + cbusMsg.eventVariableValue});
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

	processAccessoryEvent(opCode, nodeNumber, eventNumber) {
        // turn the input node & event numbers into an event name
        var eventName = decToHex(nodeNumber, 4) + decToHex(eventNumber,4)
		winston.info({message: 'CBUS Network Sim: Processing accessory Event ' + opCode + " Event Name " + eventName });
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
		var msgData = cbusLib.encodeKLOC(session);
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT >>>  ' + msgData + " >>> " + cbusLib.decode(msgData).text});
	}


	// 50
	 outputRQNN(nodeNumber) {
		//Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
		var msgData = cbusLib.encodeRQNN(nodeNumber);
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT >>>  ' + msgData + " >>> " + cbusLib.decode(msgData).text});
	}
	

	// 52
	 outputNNACK(nodeNumber) {
		//NNACK Format: [<MjPri><MinPri=3><CANID>]<52><NN hi><NN lo>
        var msgData = cbusLib.encodeNNACK(nodeNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}
	

	// 59
	 outputWRACK(nodeNumber) {
		//WRACK Format: [<MjPri><MinPri=3><CANID>]<59><NN hi><NN lo>
        var msgData = cbusLib.encodeWRACK(nodeNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}
	

	// 60
	 outputDFUN(session, fn1, fn2) {
		// Format: [<MjPri><MinPri=2><CANID>]<60><Session><Fn1><Fn2>
        var msgData = cbusLib.encodeDFUN(session, fn1, fn2)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 63
	 outputERR(data1, data2, errorNumber) {
		// Format: [<MjPri><MinPri=2><CANID>]<63><Dat 1><Dat 2><Dat 3>
        var msgData = cbusLib.encodeERR(data1, data2, errorNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 6F
	 outputCMDERR(nodeNumber, errorNumber) {
		// Format: [<MjPri><MinPri=3><CANID>]<6F><NN hi><NN lo><Error number>
        var msgData = cbusLib.encodeCMDERR(nodeNumber, errorNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 74
	 outputNUMEV(nodeNumber) {
		// Format: [<MjPri><MinPri=3><CANID>]<74><NN hi><NN lo><No.of events>
		var storedEventsCount = this.getModule(nodeNumber).getStoredEventsCount();
        var msgData = cbusLib.encodeNUMEV(nodeNumber, storedEventsCount)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}

	// 90
	 outputACON(nodeNumber, eventNumber) {
		// ASON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
        var msgData = cbusLib.encodeACON(nodeNumber, eventNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 91
	 outputACOF(nodeNumber, eventNumber) {
		// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
        var msgData = cbusLib.encodeACOF(nodeNumber, eventNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 97
	 outputNVANS(nodeNumber, nodeVariableIndex) {
		// NVANS Format: [<MjPri><MinPri=3><CANID>]<97><NN hi><NN lo><NV# ><NV val>
		var variables = this.getModule(nodeNumber).getVariables();
		if (nodeVariableIndex < variables.length) {
			var value = variables[nodeVariableIndex];
            var msgData = cbusLib.encodeNVANS(nodeNumber, nodeVariableIndex, value)
            this.socket.write(msgData);
            winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
        }
		else
			winston.info({message: 'CBUS Network Sim:  ************ NVANS variable index exceeded ************'});
	 }


	// 98
	 outputASON(nodeNumber, deviceNumber) {
		// ASON Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DD hi><DD lo>
        var msgData = cbusLib.encodeASON(nodeNumber, deviceNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 99
	 outputASOF(nodeNumber, deviceNumber) {
		// ASOF Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DD hi><DD lo>
        var msgData = cbusLib.encodeASOF(nodeNumber, deviceNumber)
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 9B
	 outputPARAN(nodeNumber, parameterIndex) {
		// Format: [<MjPri><MinPri=3><CANID>]<9B><NN hi><NN lo><Para#><Para val>
		if (parameterIndex <= this.getModule(nodeNumber).getParameter(0)) {
			var parameterValue = this.getModule(nodeNumber).getParameter(parameterIndex);
            var msgData = cbusLib.encodePARAN(nodeNumber, parameterIndex, parameterValue)
            this.socket.write(msgData);
            winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
		}
	}
	
	// B5
	outputNEVAL(nodeNumber, eventIndex, eventVariableIndex) {
		// NEVAL Format: [<MjPri><MinPri=3><CANID>]<B5><NN hi><NN lo><EN#><EV#><EVval>
		var events = this.getModule(nodeNumber).getStoredEvents();
        if (eventIndex < events.length) {
            if (eventVariableIndex < events[eventIndex].variables.length) {
                var eventVariableValue = events[eventIndex].variables[eventVariableIndex];
                var msgData = cbusLib.encodeNEVAL(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue)
                this.socket.write(msgData);
                winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ event variable index exceeded ' + eventVariableIndex + ' ************'});
            }
        }
        else {
            winston.info({message: 'CBUS Network Sim:  ************ event index exceeded ' + eventIndex + ' ************'});
        }
	}
	
	// B6
	 outputPNN(nodeNumber) {
        var msgData = cbusLib.encodePNN(nodeNumber, 
            this.getModule(nodeNumber).getManufacturerId(),
            this.getModule(nodeNumber).getModuleId(),
            this.getModule(nodeNumber).getFlags())
		winston.info({message: 'CBUS Network Sim:  OUT >>> ' + msgData + " >>> " + cbusLib.decode(msgData).text});
		this.socket.write(msgData);
	}
	
	//F2
	outputENRSP(nodeNumber, eventIndex) {
		// ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
		var events = this.getModule(nodeNumber).getStoredEvents();
        var eventName = events[eventIndex].eventName
        var msgData = cbusLib.encodeENRSP(nodeNumber, eventName, eventIndex)
        this.socket.write(msgData);
        winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// FC
	 outputUNSUPOPCODE(nodeNumber) {
		// Ficticious opcode - 'FC' currently unused
		// Format: [<MjPri><MinPri=3><CANID>]<FC><NN hi><NN lo>
		var msgData = ':SB780N' + 'FC' + decToHex(nodeNumber, 4) + ';';
		this.socket.write(msgData);
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + cbusLib.decode(msgData).text});
	}
}

module.exports = {
    cbusNetworkSimulator: cbusNetworkSimulator
}



