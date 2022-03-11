'use strict';
var winston = require('winston');		// use config from root instance
const net = require('net');
var cbusLib = require('cbuslibrary')

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

class cbusNetworkSimulator {
    constructor(NET_PORT, suppliedModules) {
		winston.info({message: '\nCBUS Network Sim: Starting on Port Number : ' + NET_PORT + '\n'});
        
        this.modules = suppliedModules;

		this.sendArray = [];
		this.socket;
		this.learningNode;
        
        this.clients = [];
		
		this.server = net.createServer(function (socket) {
			this.socket=socket;
            this.clients.push(socket);
	
			socket.setKeepAlive(true,60000);
			socket.on('data', function (data) {
				winston.info({message: 'CBUS Network Sim: Receive  <<<< Port ' + socket.remotePort + ' Data: ' + data});
				const msgArray = data.toString().split(";");
				for (var msgIndex = 0; msgIndex < msgArray.length - 1; msgIndex++) {
					var message = msgArray[msgIndex].concat(";");				// add back the ';' terminator that was lost in the split
					this.sendArray.push(message);					// store the incoming messages so the test can inspect them
                    winston.info({message: 'CBUS Network Sim: <<< Received message [' + msgIndex + '] ' +  message + " <<< "});
                    var cbusMsg = cbusLib.decode(message)      // decode into cbus message
                    if ( cbusMsg.ID_TYPE == 'S' ) {
                        this.processStandardMessage(cbusMsg)
                    } else if ( cbusMsg.ID_TYPE == 'X' ) {
                        this.processExtendedMessage(cbusMsg)
                    } else {
                        winston.info({message: 'CBUS Network Sim: <<< Received message UNKNOWN ID TYPE [' + msgIndex + '] ' +  message + " <<< "});
                    }
				}
			}.bind(this));

			socket.on('end', function () {
                this.clients.splice(this.clients.indexOf(socket), 1);
				winston.info({message: 'CBUS Network Sim: Client Disconnected at port : ' + socket.remotePort});
			}.bind(this));
			
			socket.on('error', function(err) {
				winston.info({message: 'CBUS Network Sim: Port ' + socket.remotePort + ' Socket error ' + err});
                this.clients.splice(this.clients.indexOf(socket), 1);
                socket.end();
				winston.info({message: 'CBUS Network Sim: Port ' + socket.remotePort + ' Socket ended '});
			}.bind(this));
			
		}.bind(this));

		this.server.listen(NET_PORT);
		
		// emitted when new client connects
		this.server.on('connection',function(socket){
			winston.info({message: 'CBUS Network Sim: remote client at port : ' + socket.remotePort});
		});
        
	} // end constructor


	stopServer() {
		winston.info({message: 'CBUS Network Sim: ' + this.clients.length + ' Clients connected'});
        this.clients.forEach(function (client) {
            client.end();
            winston.debug({message: 'CBUS Network Sim: client ending >>>> Port: ' + client.remotePort});
        });
		this.server.close();
		winston.info({message: 'CBUS Network Sim: Server closing'});
	}


    processExtendedMessage(cbusMsg) {
        winston.info({message: 'CBUS Network Sim: <<< Received EXTENDED ID message ' + cbusMsg.text });
        if (cbusMsg.type == 'CONTROL') {
            switch (cbusMsg.SPCMD) {
                case 0:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_NOP <<< '});
                    break;
                case 1:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_RESET  <<< '});
                    break;
                case 2:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_RST_CHKSM <<< '});
                    break;
                case 3:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_CHK_RUN <<< '});
                    this.outputExtResponse(1)   // 1 = ok ( 0 = not ok)
                    break;
                case 4:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_BOOT_TEST <<< '});
                    this.outputExtResponse(2)   // 2 = confirm boot load
                    break;
                default:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message UNKNOWN COMMAND ' + cbusMsg.text});
                    break
            }
        }
    }
    
    broadcast(msgData) {
        this.clients.forEach(function (client) {
            client.write(msgData);
            winston.debug({message: 'CBUS Network Sim: Transmit >>>> Port: ' + client.remotePort + ' Data: ' + msgData});
        });
    }

    
    outputExtResponse(value) {
		var msgData = cbusLib.encode_EXT_RESPONSE(value)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT >>>  ' + msgData + " >>> "});
    }


    processStandardMessage(cbusMsg) {
        winston.info({message: 'CBUS Network Sim: <<< Received Standard ID message ' + cbusMsg.text});
        switch (cbusMsg.opCode) {
        case '0D': //QNN
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
                this.outputPNN(this.modules[moduleIndex].getNodeNumber());
            }
            break;
        case '10': // RQNP
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
                this.outputPARAMS(this.modules[moduleIndex].getNodeNumber());
            }
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
            winston.info({message: 'CBUS Network Sim: Node ' + cbusMsg.nodeNumber + ' learn mode cancelled' });
            break;
        case '55': // NNCLR
            var nodeNumber = cbusMsg.nodeNumber
            if (this.getModule(nodeNumber) != undefined) {
                if ( nodeNumber == this.learningNode) {
                    this.getModule(nodeNumber).clearStoredEvents();
                    winston.info({message: 'CBUS Network Sim: Node ' + nodeNumber + " events cleared"});
                    this.outputWRACK(cbusMsg.nodeNumber);
                }
            }
            break;
        case '56': // NNEVN
            this.outputEVNLF(cbusMsg.nodeNumber);                
            break;
        case '57': // NERD
            var nodeNumber = cbusMsg.nodeNumber
            if (this.getModule(nodeNumber) != undefined) {
                var events = this.getModule(nodeNumber).getStoredEvents();
                for (var i = 0; i < events.length; i++) {
                    this.outputENRSP(nodeNumber, i);
                }
            }
            break;
        case '58': // RQEVN
            this.outputNUMEV(cbusMsg.nodeNumber);
            break;
        case '59': // WRACK - sent by node
            break;
        case '5C': // BOOTM
            winston.info({message: 'CBUS Network Sim: Node ' + cbusMsg.nodeNumber + " BOOT MODE command" });
            this.outputNNACK(cbusMsg.nodeNumber);
            break;
        case '5D': // ENUM
            winston.info({message: 'CBUS Network Sim: Node ' + cbusMsg.nodeNumber + " ENUM command" });
            this.outputNNACK(cbusMsg.nodeNumber);
            break;
        case '6F': // CMDERR - sent by node
            break;
        case '71': // NVRD
            this.outputNVANS(cbusMsg.nodeNumber, cbusMsg.nodeVariableIndex);
            break;
        case '72': // NENRD
            if (this.getModule(cbusMsg.nodeNumber) != undefined) {
                this.outputENRSP(cbusMsg.nodeNumber, cbusMsg.eventIndex);
            }
            break;
        case '73': // RQNPN
            this.outputPARAN(cbusMsg.nodeNumber, cbusMsg.parameterIndex);
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
                this.outputWRACK(this.learningNode);
            } else {
                winston.info({message: 'CBUS Network Sim: EVULN - not in learn mode'});
            }
            break;
        case '96': // NVSET
            if (this.getModule(cbusMsg.nodeNumber) != undefined) {
                var variables = this.getModule(cbusMsg.nodeNumber).getVariables();
                if (cbusMsg.nodeVariableIndex < variables.length) {
                    variables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue;
                    winston.info({message: 'CBUS Network Sim: NVSET Nove variable ' + cbusMsg.nodeVariableIndex + ' set to ' + cbusMsg.nodeVariableValue});
                    this.outputWRACK(cbusMsg.nodeNumber);
                }
                else {
                    winston.info({message: 'CBUS Network Sim:  ************ NVSET variable index exceeded ************'});
                    this.outputCMDERR(cbusMsg.nodeNumber, 10);
                }
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
        case 'B2': // REQEV
                winston.info({message: 'CBUS Network Sim: received REQEV'});
            this.outputEVANS(cbusMsg.nodeNumber, cbusMsg.eventNumber, cbusMsg.eventName, cbusMsg.eventVariableIndex)
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
            winston.info({message: 'CBUS Network Sim: *************************** received unknown opcode ' + cbusMsg.opCode});
            break;
        }        
    }


	getSendArray() {
		return this.sendArray;
	}

	
	clearSendArray() {
		this.sendArray = [];
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
        winston.info({message: 'CBUS Network Sim: getEventByName : nodeNumber ' + nodeNumber + ' eventName ' + eventName});
        if (this.getModule(nodeNumber) != undefined) {
            var events = this.getModule(nodeNumber).getStoredEvents();
            for (var eventIndex = 0; eventIndex < events.length; eventIndex++) {
                if (events[eventIndex].eventName == eventName) return events[eventIndex];
            }
            // if we get here then event doesn't yet exist, so create it
            return this.getModule(nodeNumber).addNewEvent(eventName);
        }
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
		var msgData = cbusLib.encodeKLOC(session);
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT >>>  ' + msgData + " >>> " + cbusLib.decode(msgData).text});
	}


	// 50
	 outputRQNN(nodeNumber) {
		var msgData = cbusLib.encodeRQNN(nodeNumber);
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT >>>  ' + msgData + " >>> " + cbusLib.decode(msgData).text});
	}
	

	// 52
	 outputNNACK(nodeNumber) {
        var msgData = cbusLib.encodeNNACK(nodeNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}
	

	// 59
	 outputWRACK(nodeNumber) {
        var msgData = cbusLib.encodeWRACK(nodeNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}
	

	// 60
	 outputDFUN(session, fn1, fn2) {
        var msgData = cbusLib.encodeDFUN(session, fn1, fn2)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 63
	 outputERR(data1, data2, errorNumber) {
        var msgData = cbusLib.encodeERR(data1, data2, errorNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 6F
	 outputCMDERR(nodeNumber, errorNumber) {
        var msgData = cbusLib.encodeCMDERR(nodeNumber, errorNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 70
	 outputEVNLF(nodeNumber) {
        if (this.getModule(nodeNumber) != undefined) {
            var msgData = cbusLib.encodeEVNLF(nodeNumber, this.getModule(nodeNumber).getFreeSpace())
            this.broadcast(msgData)
            winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
        }
	}


	// 74
	 outputNUMEV(nodeNumber) {
        if (this.getModule(nodeNumber) != undefined) {
            var storedEventsCount = this.getModule(nodeNumber).getStoredEventsCount();
            var msgData = cbusLib.encodeNUMEV(nodeNumber, storedEventsCount)
            this.broadcast(msgData)
            winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
        }
	}

	// 90
	 outputACON(nodeNumber, eventNumber) {
        var msgData = cbusLib.encodeACON(nodeNumber, eventNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 91
	 outputACOF(nodeNumber, eventNumber) {
        var msgData = cbusLib.encodeACOF(nodeNumber, eventNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 97
	 outputNVANS(nodeNumber, nodeVariableIndex) {
        if (this.getModule(nodeNumber) != undefined) {
            var variables = this.getModule(nodeNumber).getVariables();
            if (nodeVariableIndex < variables.length) {
                var value = variables[nodeVariableIndex];
                var msgData = cbusLib.encodeNVANS(nodeNumber, nodeVariableIndex, value)
                this.broadcast(msgData)
                winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ NVANS variable index exceeded ************'});
                this.outputCMDERR(nodeNumber, 10);
            }
       }
	 }


	// 98
	 outputASON(nodeNumber, deviceNumber) {
        var msgData = cbusLib.encodeASON(nodeNumber, deviceNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 99
	 outputASOF(nodeNumber, deviceNumber) {
        var msgData = cbusLib.encodeASOF(nodeNumber, deviceNumber)
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
	}


	// 9B
	 outputPARAN(nodeNumber, parameterIndex) {
        if (this.getModule(nodeNumber) != undefined) {
            if (parameterIndex <= this.getModule(nodeNumber).getParameter(0)) {
                var parameterValue = this.getModule(nodeNumber).getParameter(parameterIndex);
                var msgData = cbusLib.encodePARAN(nodeNumber, parameterIndex, parameterValue)
                this.broadcast(msgData)
                winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ parameter index exceeded ' + parameterIndex + ' ************'});
                this.outputCMDERR(nodeNumber, 9)                    
            }
        }
	}
	
	// B5
	outputNEVAL(nodeNumber, eventIndex, eventVariableIndex) {
        if (this.getModule(nodeNumber) != undefined) {
            var events = this.getModule(nodeNumber).getStoredEvents();
            if (eventIndex < events.length) {
                if (eventVariableIndex < events[eventIndex].variables.length) {
                    var eventVariableValue = events[eventIndex].variables[eventVariableIndex];
                    var msgData = cbusLib.encodeNEVAL(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue)
                    this.broadcast(msgData)
                    winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
                }
                else {
                    winston.info({message: 'CBUS Network Sim:  ************ event variable index exceeded ' + eventVariableIndex + ' ************'});
                    this.outputCMDERR(nodeNumber, 6)                    
                }
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ event index exceeded ' + eventIndex + ' ************'});
            }
        }
	}
	
	// B6
	 outputPNN(nodeNumber) {
        var msgData = cbusLib.encodePNN(nodeNumber, 
            this.getModule(nodeNumber).getManufacturerId(),
            this.getModule(nodeNumber).getModuleId(),
            this.getModule(nodeNumber).getFlags())
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT >>> ' + msgData + " >>> " + cbusLib.decode(msgData).text});
	}
	
	// D3
	outputEVANS(nodeNumber, eventNumber, eventName, eventVariableIndex) {
        winston.info({message: 'CBUS Network Sim: EVANS : Node ' + nodeNumber + " eventNumber " + eventNumber + " eventName "+ eventName + " evIndex " + eventVariableIndex});
        if (this.getModule(this.learningNode) != undefined) {
            var event = this.getEventByName(this.learningNode, eventName);
            if (event != undefined) {
                if (eventVariableIndex < event.variables.length) {
                    var eventVariableValue = event.variables[eventVariableIndex];
                    var msgData = cbusLib.encodeEVANS(nodeNumber, eventNumber, eventVariableIndex, eventVariableValue)
                    this.broadcast(msgData)
                    winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
                }
                else {
                    winston.info({message: 'CBUS Network Sim:  ************ event variable index exceeded ' + eventVariableIndex + ' ************'});
                    this.outputCMDERR(nodeNumber, 6)    // Invalid event variable index                    
                }
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ event number not valid ' + eventNumber + ' ************'});
                this.outputCMDERR(nodeNumber, 7)        // invalid event                    
            }
        }
        else {
                winston.info({message: 'CBUS Network Sim:  ************ node number not valid ' + nodeNumber + ' ************'});
        }
	}
	
	// EF
	 outputPARAMS(nodeNumber) {
        if (this.getModule(nodeNumber) != undefined) {
            var msgData = cbusLib.encodePARAMS(
                this.getModule(nodeNumber).getParameter(1), 
                this.getModule(nodeNumber).getParameter(2), 
                this.getModule(nodeNumber).getParameter(3), 
                this.getModule(nodeNumber).getParameter(4), 
                this.getModule(nodeNumber).getParameter(5), 
                this.getModule(nodeNumber).getParameter(6), 
                this.getModule(nodeNumber).getParameter(7), 
                )
            this.broadcast(msgData)
            winston.info({message: 'CBUS Network Sim:  OUT >>> ' + msgData + " >>> " + cbusLib.decode(msgData).text});
        }
	}
	
	//F2
	outputENRSP(nodeNumber, eventIndex) {
        if (this.getModule(nodeNumber) != undefined) {
            if (eventIndex <= this.getModule(nodeNumber).getStoredEventsCount()) {
                var events = this.getModule(nodeNumber).getStoredEvents();
                var eventName = events[eventIndex].eventName
                var msgData = cbusLib.encodeENRSP(nodeNumber, eventName, eventIndex)
                this.broadcast(msgData)
                winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
            }
            else {
                winston.info({message: 'CBUS Network Sim:  ************ EVENT index exceeded ************'});
                this.outputCMDERR(nodeNumber, 7);
            }
        }
	}


	// FC
	 outputUNSUPOPCODE(nodeNumber) {
		// Ficticious opcode - 'FC' currently unused 
		// Format: [<MjPri><MinPri=3><CANID>]<FC><NN hi><NN lo>
		var msgData = ':SB780N' + 'FC' + decToHex(nodeNumber, 4) + ';';     // don't have an encode for ficticious opcode
        this.broadcast(msgData)
		winston.info({message: 'CBUS Network Sim:  OUT>> ' + msgData + " " + cbusLib.decode(msgData).text});
	}
}

module.exports = {
    cbusNetworkSimulator: cbusNetworkSimulator
}



