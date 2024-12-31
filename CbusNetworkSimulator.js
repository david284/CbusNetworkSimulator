'use strict';
var winston = require('winston');		// use config from root instance
const net = require('net');
const fs = require('fs');
var path = require('path');
var cbusLib = require('cbuslibrary')
const GRSP = require('./Definitions/GRSP_definitions.js');

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

// bit weights
const CTLBT_WRITE_UNLOCK = 0
const CTLBT_ERASE_ONLY = 1
const CTLBT_AUTO_ERASE = 2
const CTLBT_AUTO_INC = 3
const CTLBT_ACK = 4



//
//
//
function  arrayChecksum(array, start) {
  var checksum = 0;
  if ( start != undefined) {
      checksum = (parseInt(start, 16) ^ 0xFFFF) + 1;
  }
  for (var i = 0; i <array.length; i++) {
      checksum += array[i]
      checksum = checksum & 0xFFFF        // trim to 16 bits
  }
  var checksum2C = decToHex((checksum ^ 0xFFFF) + 1, 4)    // checksum as two's complement in hexadecimal
  winston.debug({message: 'arrayChecksum: ' + checksum2C});
  return checksum2C
}

const busTrafficPath = path.join(__dirname, "./", "logs", "busTraffic.txt")


class cbusNetworkSimulator {
    constructor(NET_PORT, suppliedModules) {
		winston.info({message: '\nCBUS Network Sim: Starting on Port Number : ' + NET_PORT + '\n'});
    this.busTrafficLogStream = fs.createWriteStream(busTrafficPath, {flags: 'a+'});        
    this.modules = suppliedModules;
		this.sendArray = [];
		this.socket;
		this.learningNode;
    this.outDelay = 10;
    this.ackRequested = false
    this.runningChecksum = 0
        
    this.clients = [];
		
		// we want heartbeat to be sent out every 5 seconds for each module
		// we use a counter to send one module out each pass of the interval
		// so set interval time as 5 seconds divided by number of modules
		var interval_time = 5000/this.modules.length;
//		var interval_time = 5000;
		this.interval_counter = 0;
		setInterval(this.heartbIntervalFunc.bind(this), interval_time);
    
    // We want to send out events every 5 seconds if enabled, so create interval for this
    //
		setInterval(this.eventIntervalFunc.bind(this),5000);
    
		
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
                    this.writeBusTraffic('<<<IN ' + cbusMsg.text)
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

	
	heartbIntervalFunc() {
    var nodeNumber = this.modules[this.interval_counter].nodeNumber
    if (this.getModule(nodeNumber).getHeartBeatenabled()){
      winston.debug({message: 'CBUS Network Sim: HEARTB Interval - node ' + nodeNumber});
      this.outputHEARTB(nodeNumber);
    }
    if (this.interval_counter+1 >= this.modules.length) {this.interval_counter = 0} else (this.interval_counter++);
	};


	eventIntervalFunc() {
		winston.debug({message: 'CBUS Network Sim: event interval'});
    for (var i = 0; i < this.modules.length; i++) {
      var event = this.modules[i].sendEvents()
      if (event) {
        if (parseInt(event.eventName.substr(0,4), 16) == 0) {
          this.outputASON(this.modules[i].nodeNumber, parseInt(event.eventName.substr(4,4), 16))
        } else {
          this.outputACON(this.modules[i].nodeNumber, parseInt(event.eventName.substr(4,4), 16))
        }
      }
    }
	};


	toggleHEARTBEAT(nodeNumber){
		if (this.getModule(nodeNumber).getHeartBeatenabled()) {
			this.getModule(nodeNumber).setHeartBeatEnabled(false);
      winston.info({message: 'CBUS Network Sim: heartbeat disabled for node ' + nodeNumber});
		} else {
			this.getModule(nodeNumber).setHeartBeatEnabled(true);
      winston.info({message: 'CBUS Network Sim: heartb enabled for node ' + nodeNumber});
		}
		return this.getModule(nodeNumber).getHeartBeatenabled();
	}


	startSetup(nodeNumber){
    if (nodeNumber != undefined) {
      var module = this.getModule(nodeNumber)
      if (module) {
        winston.info({message: 'CBUS Network Sim: startSetup: matching module found - node ' + nodeNumber + ' ' + module.NAME});
        module.startSetupMode()
        this.outputRQNN(nodeNumber)
      } else {
        winston.info({message: 'CBUS Network Sim: startSetup: No matching module found'});
      }
    } else {
      winston.warn({message: 'CBUS Network Sim: startSetup: nodeNumber undefined'});
    }
	}


	endSetup(module){
		module.endSetupMode();
	}

  
 toggleSendEvents(nodeNumber){
    if (nodeNumber) {
      var module = this.getModule(nodeNumber)
      if (module) {
        module.toggleSendEvents()
      } else {
        winston.info({message: 'CBUS Network Sim: enableEvents: No matching module found'});
      }
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
			if (this.modules[i].nodeNumber == nodeNumber) return this.modules[i];
		}
	}


	getModuleIndex(nodeNumber) {
		for (var i = 0; i < this.modules.length; i++) {
			if (this.modules[i].nodeNumber == nodeNumber) return i;
		}
	}


	getEventByName(nodeNumber, eventName) {
        winston.info({message: 'CBUS Network Sim: getEventByName : nodeNumber ' + nodeNumber + ' eventName ' + eventName});
    if (eventName != undefined) {
        if (this.getModule(nodeNumber) != undefined) {
            var events = this.getModule(nodeNumber).storedEvents;
            for (var eventIndex = 0; eventIndex < events.length; eventIndex++) {
                if (events[eventIndex].eventName == eventName) return events[eventIndex];
            }
            // if we get here then event doesn't yet exist, so create it
            return this.getModule(nodeNumber).addNewStoredEvent(eventName);
        }
    } else {
        winston.warn({message: 'CBUS Network Sim: *** WARNING *** getEventByName : eventName undefined'});
    }
	}

	getEventByName2(nodeNumber, eventIdentifier) {
    winston.info({message: 'CBUS Network Sim: getEventByName2 : nodeNumber ' + nodeNumber + ' eventIdentifier ' + eventIdentifier});
    var returnEvent = null
    if ((nodeNumber != undefined) && (eventIdentifier != undefined)) {
      var module = this.getModule(nodeNumber);
      if (module){
        var events = module.storedEvents;
        module.storedEvents.forEach(event => {
          if (event.eventName == eventIdentifier) {
            winston.debug({message: 'CBUS Network Sim: getEventByName2: matched eventIdentifier ' + eventIdentifier});
            returnEvent = event
          }
        })
        if (returnEvent == null ){ winston.debug({message: 'CBUS Network Sim: getEventByName2: no event found for eventIdentifier ' + eventIdentifier}); }
      } else {
        winston.debug({message: 'CBUS Network Sim: getEventByName2: nodeNumber ' + nodeNumber + " undefined module"});        
      }
    }
    return returnEvent
  }
    

	deleteEventByName(nodeNumber, eventName) {
    var result = false
		var events = this.getModule(nodeNumber).storedEvents;
		var eventIndex;
		// look for matching eventName in array
		for (var index = 0; index < events.length; index++) {
			if (events[index].eventName == eventName) {
				eventIndex = index;
				break;
			}
		}
		// if a matching eventName was found, then remove entry from array
		if (eventIndex != undefined) { 
      events.splice(eventIndex, 1) 
      result = true
    }
    return result
	}


//-------------------------------------------------------------------------------
// Process incoming messages
//-------------------------------------------------------------------------------

    async processStandardMessage(cbusMsg) {
        winston.info({message: 'CBUS Network Sim: <<< Received Standard ID message ' + cbusMsg.text});
        switch (cbusMsg.opCode) {
        case '0D': //QNN
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
              await sleep(this.outDelay)
              this.outputPNN(this.modules[moduleIndex]);
            }
            break;
        case '10': // RQNP
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
				// should only respond if in setup mode
				if (this.modules[moduleIndex].inSetupMode()){
					this.outputPARAMS(this.modules[moduleIndex].nodeNumber);
				}
            }
            break;
        case '11': // RQMN
		    // return the module name, but only if in setup mode
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
				// should only accept node number if in setup mode
				if (this.modules[moduleIndex].inSetupMode()){
					this.outputNAME(this.modules[moduleIndex].nodeNumber, this.modules[moduleIndex].NAME);
				}
            }
            break;
        case '42': // SNN
            // give a module a node number, but only if in setup mode
            for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
				// should only accept node number if in setup mode
				if (this.modules[moduleIndex].inSetupMode()){
					this.modules[moduleIndex].setNodeNumber(cbusMsg.nodeNumber);
					this.outputNNACK(cbusMsg.nodeNumber);
				}
            }
            break;
        case '4F': // NNRSM
            winston.info({message: 'CBUS Network Sim: Node ' + cbusMsg.nodeNumber + " NNRSM command" });
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
            break;
        case '50': // RQNN sent by node
            break;
        case '51': // NNREL sent by node
            break;
        case '52': // NNACK sent by node
            break;
        case '53': // NNLRN
            this.learningNode = cbusMsg.nodeNumber
            if (this.getModule(cbusMsg.nodeNumber) != undefined) {
              // set bit 5 (0x20)
              this.getModule(cbusMsg.nodeNumber).parameters[8] |= 0x20;
            }
            winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' put into learn mode' });
            break;
        case '54': // NNULN
            this.learningNode = undefined;
            if (this.getModule(cbusMsg.nodeNumber) != undefined) {
              // clear bit 5 (0x20)
              this.getModule(cbusMsg.nodeNumber).parameters[8] &= ~0x20;
            }
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
                var storedEvents = this.getModule(nodeNumber).storedEvents;
                for (var i = 0; i < storedEvents.length; i++) {
                    winston.info({message: 'CBUS Network Sim: event index ' + i + ' event count ' + storedEvents.length});
                    // events need to start at 1
                    await sleep(this.outDelay)
                    this.outputENRSP(nodeNumber, i + 1);
                }
            }
            break;
        case '58': // RQEVN
            this.processRQEVN(cbusMsg.nodeNumber);
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
        case '5E': // NNRST
            winston.info({message: 'CBUS Network Sim: Node ' + cbusMsg.nodeNumber + " NNRST command" });
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
            break;
        case '6F': // CMDERR - sent by node
            break;
        case '71': // NVRD
          if (cbusMsg.encoded.length != 16) {
            winston.error({message: 'CBUS Network Sim: received NVRD - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 2, GRSP.Invalid_Command);
          } else {
            this.processNVRD(cbusMsg.nodeNumber, cbusMsg.nodeVariableIndex)
          }
          break;
        case '72': // NENRD
          if (this.getModule(cbusMsg.nodeNumber) != undefined) {
              this.outputENRSP(cbusMsg.nodeNumber, cbusMsg.eventIndex);
          }
          break;
        case '73': // RQNPN
          if (cbusMsg.encoded.length != 16) {
            winston.error({message: 'CBUS Network Sim: received RQNPN - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.Invalid_Command);
          } else {
            this.processRQNPN(cbusMsg.nodeNumber, cbusMsg.parameterIndex);
          }
          break;
          case '75': // CANID
          if (cbusMsg.encoded.length < 16) {
            winston.error({message: 'CBUS Network Sim: received CANID - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.Invalid_Command);
          } else if ((cbusMsg.CAN_ID < 1) || (cbusMsg.CAN_ID > 99)){
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.Invalid_parameter);  
            this.outputCMDERR(cbusMsg.nodeNumber, GRSP.InvalidEvent);
          } else {
            // valid command, so process (but only if module exists)
            if (this.getModule(cbusMsg.nodeNumber) != undefined) {
              this.getModule(cbusMsg.nodeNumber).CanId = cbusMsg.CAN_ID
              this.outputENRSP(cbusMsg.nodeNumber, cbusMsg.eventIndex);
              this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);  
              this.outputWRACK(cbusMsg.nodeNumber);                
            }
          }
          break;
        case '76': // MODE Format: [<MjPri><MinPri=3><CANID>]<78><NN hi><NN lo><ModeNumber>
          var module = this.getModule(cbusMsg.nodeNumber);
                if (module != undefined) {
            switch (cbusMsg.ModeNumber){
              case 0x0:		// setup mode
                this.startSetup(cbusMsg.nodeNumber);
                this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
                break;
              case 0x1:   // normal 'run' mode
                this.endSetup(module);
                this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
                break;
              case 0xC:
                // turn on heartbeat
                this.getModule(cbusMsg.nodeNumber).setHeartBeatEnabled(true);
                this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
                break;
              case 0xD:
                // turn off heartbeat
                this.getModule(cbusMsg.nodeNumber).setHeartBeatEnabled(false);
                this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.OK);
                break;
              default:
              winston.info({message: 'CBUS Network Sim: unsupported ModeNumber ' + cbusMsg.ModeNumber});
            }
          } else {
            winston.info({message: 'CBUS Network Sim: No module found for Node Number ' + cbusMsg.nodeNumber});
          }
          break;
        case '78': // RQSD Format: [<MjPri><MinPri=3><CANID>]<78><NN hi><NN lo><ServiceIndex>
          if (cbusMsg.encoded.length != 16) {
            winston.error({message: 'CBUS Network Sim: received RQSD - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, cbusMsg.ServiceIndex, GRSP.Invalid_Command);
          } else {
            if (cbusMsg.ServiceIndex == 0){
              this.outputSD(cbusMsg.nodeNumber);
            } else {
              this.outputESD(cbusMsg.nodeNumber, cbusMsg.ServiceIndex);
            }
          }
          break;
        case '87': // RDGN Format: [<MjPri><MinPri=3><CANID>]<87><NN hi><NN lo><ServiceIndex><DiagnosticeCode>
          if (cbusMsg.encoded.length != 18) {
            winston.error({message: 'CBUS Network Sim: received RDGN - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 2, GRSP.Invalid_Command);
          } else {
            this.outputDGN(cbusMsg.nodeNumber, cbusMsg.ServiceIndex, cbusMsg.DiagnosticCode);
          }
          break;
        case '8E': // NVSETRD
          if (cbusMsg.encoded.length != 18) {
            winston.error({message: 'CBUS Network Sim: received NVSETRD - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 0, GRSP.Invalid_Command);
          } else {
            var module = this.getModule(cbusMsg.nodeNumber);
            if (module != undefined) {
              var nodeVariables = module.nodeVariables;
              if (cbusMsg.nodeVariableIndex < nodeVariables.length) {
                  nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue;
                  winston.info({message: 'CBUS Network Sim: NVSETRD Node variable ' + cbusMsg.nodeVariableIndex + ' set to ' + cbusMsg.nodeVariableValue});
                  this.outputNVANS(cbusMsg.nodeNumber, cbusMsg.nodeVariableIndex, nodeVariables[cbusMsg.nodeVariableIndex])  
              }
              else {
                  winston.info({message: 'CBUS Network Sim:  ************ NVSETRD variable index exceeded ************'});
//                  this.outputCMDERR(cbusMsg.nodeNumber, 10);  // 10 = Invalid Node Variable Index
                  this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 0, GRSP.InvalidNodeVariableIndex);
                }
              }
            }
            break;
        case '90': // ACON
            this.processAccessoryEvent("ACON", cbusMsg.nodeNumber, cbusMsg.eventNumber);
            break;
        case '91': // ACOF
            this.processAccessoryEvent("ACOF", cbusMsg.nodeNumber, cbusMsg.eventNumber);
            break;
        case '92': // AREQ
            this.outputARON(cbusMsg.nodeNumber, cbusMsg.eventNumber);
            break;
        case '95': // EVULN
            if (this.learningNode != undefined) {
              if (cbusMsg.encoded.length != 18) {
                winston.error({message: 'CBUS Network Sim: received EVULN - length wrong'});
                this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.Invalid_Command);
              } else {
                // Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
                
                if (this.deleteEventByName(this.learningNode, cbusMsg.eventIdentifier)){
                  winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' deleted eventIdentifier ' + cbusMsg.eventIdentifier});
                  this.outputWRACK(this.learningNode);
                } else {
                  this.outputCMDERR(this.learningNode, GRSP.InvalidEvent);
                  this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.InvalidEvent);
                }
              }
            } else {
                winston.info({message: 'CBUS Network Sim: EVULN - not in learn mode'});
            }
            break;
        case '96': // NVSET
          if (cbusMsg.encoded.length != 18) {
            winston.error({message: 'CBUS Network Sim: received NVSET - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 0, GRSP.Invalid_Command);
          } else {
            var module = this.getModule(cbusMsg.nodeNumber);
              if (module != undefined) {
                // check if module needs to be in learn mode, and if so, is it in learn mode?
                if ((!module.NVsetNeedsLearnMode) || ((module.NVsetNeedsLearnMode) && (this.learningNode == cbusMsg.nodeNumber))) {
                  var nodeVariables = module.nodeVariables;
                  if (cbusMsg.nodeVariableIndex < nodeVariables.length) {
                      nodeVariables[cbusMsg.nodeVariableIndex] = cbusMsg.nodeVariableValue;
                      winston.info({message: 'CBUS Network Sim: NVSET Nove variable ' + cbusMsg.nodeVariableIndex + ' set to ' + cbusMsg.nodeVariableValue});
                      this.outputWRACK(cbusMsg.nodeNumber);
                  }
                  else {
                      winston.info({message: 'CBUS Network Sim:  ************ NVSET variable index exceeded ************'});
                      this.outputCMDERR(cbusMsg.nodeNumber, 10);  // 10 = Invalid Node Variable Index
                  }
                } else {
                    winston.info({message: 'CBUS Network Sim:  ************ NVSET needs to be in learn mode ************'});
                    this.outputCMDERR(cbusMsg.nodeNumber, 2);   // 2 = Not in learn mode
                }
              }
            }
            break;
        case '98': // ASON
            this.processAccessoryEvent("ASON", 0, cbusMsg.deviceNumber);
            break;
        case '99': // ASOF
            this.processAccessoryEvent("ASOF", 0, cbusMsg.deviceNumber);
            break;
        case '9A': //ASRQ
          // Format: [<MjPri><MinPri=3><CANID>]<9A><NN hi><NN lo><EN hi><EN lo>
          winston.debug({message: 'CBUS Network Sim: received ASRQ'});
          if (cbusMsg.encoded.length != 18) {
            winston.error({message: 'CBUS Network Sim: received ASRQ - length wrong'});
            this.outputGRSP(this.learningNode, cbusMsg.opCode, 1, GRSP.Invalid_Command);
          } else {
            if (cbusMsg.deviceNumber > 0 ) {
              this.outputARSON(cbusMsg.nodeNumber, cbusMsg.deviceNumber)
            } else {
              this.outputARSOF(cbusMsg.nodeNumber, cbusMsg.deviceNumber)
            }
          }
          break;
        case '9C': // REVAL
          winston.debug({message: 'CBUS Network Sim: received REVAL'});
          if (cbusMsg.encoded.length != 18) {
            winston.error({message: 'CBUS Network Sim: received REVAL - length wrong'});
            this.outputGRSP(cbusMsg.nodeNumber, cbusMsg.opCode, 1, GRSP.Invalid_Command);
          } else {
            this.processREVAL(cbusMsg.nodeNumber, cbusMsg.eventIndex, cbusMsg.eventVariableIndex)
          }
          break;
        case 'B2': // REQEV
          winston.info({message: 'CBUS Network Sim: received REQEV'});
          if (cbusMsg.encoded.length != 20) {
            winston.error({message: 'CBUS Network Sim: received REQEV - length wrong'});
            this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.Invalid_Command);
          } else {
            // ok, message looks valid, go & process it
            this.processREQEV(cbusMsg.eventIdentifier, cbusMsg.eventVariableIndex)
          }
          break;
        case 'D2': // EVLRN
          winston.debug({message: 'CBUS Network Sim: EVLRN ' +  JSON.stringify(cbusMsg) });
          if (cbusMsg.encoded.length != 22) {
            winston.error({message: 'CBUS Network Sim: received EVLRN - length wrong'});
            this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.Invalid_Command);
          } else {
            if (this.learningNode != undefined) {
              // Uses the single node already put into learn mode - the node number in the message is part of the event identifier, not the node being taught
              var module = this.getModule(this.learningNode);
              var event = this.getEventByName2(this.learningNode, cbusMsg.eventIdentifier);
              if (event){
                event.variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue;
                winston.info({message: 'CBUS Network Sim: Node ' + this.learningNode + ' eventIdentifier ' + cbusMsg.eventIdentifier + 
                    ' taught EV ' + cbusMsg.eventVariableIndex + ' = ' + cbusMsg.eventVariableValue});
                if (cbusMsg.eventVariableIndex <= module.parameters[5]){
                  this.outputWRACK(this.learningNode);
                } else {
                  this.outputCMDERR(this.learningNode, GRSP.InvalidEventVariableIndex);
                  this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.InvalidEventVariableIndex);
                }
              } else {
                if ( module.getStoredEventsCount() < module.parameters[4] ) {
                  event = module.addNewStoredEvent(cbusMsg.eventIdentifier) // addEvent
                  event.variables[cbusMsg.eventVariableIndex] = cbusMsg.eventVariableValue;
                  this.outputWRACK(this.learningNode);
                } else {
                  // out of space
                  this.outputCMDERR(this.learningNode, GRSP.TooManyEvents);
                  this.outputGRSP(this.learningNode, cbusMsg.opCode, 0, GRSP.TooManyEvents);
                }
              }
            } else {
              winston.info({message: 'CBUS Network Sim: EVLRN - not in learn mode'});
              this.outputCMDERR(0, 2); // not striclty correct, as we don't know which module ought to be in learn mode, hence zero
            }
          }
          break;
        default:
            winston.info({message: 'CBUS Network Sim: *************************** received unknown opcode ' + JSON.stringify(cbusMsg)});
            if (cbusMsg.nodeNumber) {
              this.outputCMDERR(cbusMsg.nodeNumber, GRSP.CommandNotSupported);
            }
            break;
        }        
    }


  //  
	// RQEVN (0x58)
  //
	processRQEVN(nodeNumber) {
    if (this.getModule(nodeNumber) != undefined) {
      // certain modules don't support this
      if (this.getModule(nodeNumber).parameters[1] == 165){
        if (this.getModule(nodeNumber).parameters[3] == 10){ return }
      }
      //
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
      var storedEventsCount = this.getModule(nodeNumber).getStoredEventsCount();
      var msgData = cbusLib.encodeNUMEV(nodeNumber, storedEventsCount)
      this.broadcast(msgData)
    } else {
      winston.info({message: 'CBUS Network Sim:  module undefined for nodeNumber : ' + nodeNumber});
    }
	}


  //
	// NVRD (0x71)
  //
  async processNVRD(nodeNumber, nodeVariableIndex) {
    var module = this.getModule(nodeNumber)
    if (module) {
      var nodeVariables = module.nodeVariables;
      // if index = 0, send count of indexes (not including 0)
      if (nodeVariableIndex == 0){
        this.outputNVANS(nodeNumber, 0, nodeVariables.length-1);
      }
      // do either matching index, or all indexes if 0
      for (var i = 1; i < nodeVariables.length; i++) {
        if ((nodeVariableIndex == 0) || (nodeVariableIndex == i)) {
          await sleep(this.outDelay)
          this.outputNVANS(nodeNumber, i, nodeVariables[i]);
        }
      }
      if (nodeVariableIndex + 1 > nodeVariables.length) {
        this.outputCMDERR(nodeNumber, GRSP.InvalidNodeVariableIndex);
        this.outputGRSP(nodeNumber, cbusMsg.opCode, 1, GRSP.InvalidNodeVariableIndex);
      }
    }
  }

	
  //
	// RQNPN (0x73)
  //
  processRQNPN(nodeNumber, parameterIndex) {
    for (var moduleIndex = 0; moduleIndex < this.modules.length; moduleIndex++) {
      let module = this.modules[moduleIndex]
      if (module.nodeNumber == nodeNumber) {
        cbusLib.setCanHeader(2, module.CanId);
        // now, if parameter index is 0, the response should be the number of parameters
        // and if VLCB, followed by futher PARAN messages for all the parameters
        if(parameterIndex==0){
          winston.info({message: 'CBUS Network Sim:  RQNPN zero parameter '});
          var numberOfParameters = module.getParameter(0);
          var msgData = cbusLib.encodePARAN(nodeNumber, parameterIndex, numberOfParameters)
          this.broadcast(msgData)
          // now check if VLCB
          if (module.isVLCB()) {
            for (var i = 1; i <= numberOfParameters; i++ ){
              var parameterValue = module.getParameter(i);
              var msgData1 = cbusLib.encodePARAN(nodeNumber, i, parameterValue)
              this.broadcast(msgData1)
            }
          }
        } else {
          // single parameter requested
          winston.info({message: 'CBUS Network Sim:  RQNPN single parameter ' + parameterIndex});
          if (parameterIndex <= module.getParameter(0)) {
            var parameterValue = module.getParameter(parameterIndex);
            var msgData = cbusLib.encodePARAN(nodeNumber, parameterIndex, parameterValue)
            this.broadcast(msgData)
          } else {
            winston.info({message: 'CBUS Network Sim:  ************ parameter index exceeded ' + parameterIndex + ' ************'});
            this.outputCMDERR(nodeNumber, GRSP.InvalidParameterIndex)
            this.outputGRSP(nodeNumber, '73', 1, GRSP.InvalidParameterIndex);
          }
        }
      }
    }
	}
	

  // REVAL (0x9C)
  // eventIndex starts from 1
  // storedEvents array starts at 0, so subtract 1
	processREVAL(nodeNumber, eventIndex, eventVariableIndex) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
      var storedEvents = this.getModule(nodeNumber).storedEvents;
      if (eventIndex > 0) {
        if (eventIndex <= storedEvents.length) {
          if (eventVariableIndex < storedEvents[eventIndex-1].variables.length) {
            var eventVariableValue = storedEvents[eventIndex-1].variables[eventVariableIndex];
            var msgData = cbusLib.encodeNEVAL(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue)
            if ((eventVariableValue > 0) || (this.getModule(nodeNumber).sendZeroEV)){            
              this.broadcast(msgData)
            }
          } else {
            winston.info({message: 'CBUS Network Sim:  ************ event variable index exceeded ' + eventVariableIndex + ' ************'});
            this.outputCMDERR(nodeNumber, 6)                    
          }
        } else {
          winston.info({message: 'CBUS Network Sim:  ************ event index exceeded ' + eventIndex + ' ************'});
        }
      }
    }
	}

  
  //
  // REQEV (0xB2)
  //
  processREQEV(eventIdentifier, eventVariableIndex){
    var module = this.getModule(this.learningNode);
    if (module){
      var event = this.getEventByName2(this.learningNode, eventIdentifier);
      if (event != undefined) {
        if (eventVariableIndex == 0){
          // special case
          for (let i = 0; i < module.parameters[5]; i++){
            this.outputEVANS(this.learningNode, eventIdentifier, i)
          }
        }
        if (eventVariableIndex <= module.parameters[5]){
            this.outputEVANS(this.learningNode, eventIdentifier, eventVariableIndex)
        } else {
          winston.info({message: 'CBUS Network Sim:  ************ event variable index not valid ' + eventVariableIndex + ' ************'});
          this.outputCMDERR(this.learningNode, GRSP.InvalidEventVariableIndex);
          this.outputGRSP(this.learningNode, 'B2', 0, GRSP.InvalidEventVariableIndex);
        }
      } else {
        winston.info({message: 'CBUS Network Sim:  ************ event number not valid ' + eventIdentifier + ' ************'});
        this.outputCMDERR(this.learningNode, GRSP.InvalidEvent)
        this.outputGRSP(this.learningNode, 'B2', 1, GRSP.InvalidEvent);          
      }
    } else {
      winston.error({message: 'CBUS Network Sim: REQEV: ***** ERROR ***** no module found for nodeNumber ' + this.learningNode  });
    }

  }  
	
	processAccessoryEvent(opCode, nodeNumber, eventNumber) {
    var module = this.getModule(nodeNumber);
    if (module){
      if (opCode == "ACOF"){
        module.actionOffEvent(this, eventNumber)
      }
      if (opCode == "ACON"){
        module.actionOnEvent(this, eventNumber)        
      }
    }

    // turn the input node & event numbers into an event name
    var eventName = decToHex(nodeNumber, 4) + decToHex(eventNumber,4)
		winston.info({message: 'CBUS Network Sim: Processing accessory Event ' + opCode + " Event Name " + eventName });
		// check each module to see if they have a matching event
		for (var i = 0; i < this.modules.length; i++) {
			var events = this.modules[i].storedEvents;
			var nodeNumber = this.modules[i].nodeNumber;
			// look for matching eventName in array
			for (var index = 0; index < events.length; index++) {
				if (events[index].eventName == eventName) {
					// now check if we should send a feedback response
					if (this.modules[i].shouldFeedback(index)) {
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

    processExtendedMessage(cbusMsg) {
        winston.info({message: 'CBUS Network Sim: <<< Received EXTENDED ID message ' + cbusMsg.text });
        if (cbusMsg.type == 'CONTROL') {
            switch (cbusMsg.SPCMD) {
                case 0:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_NOP <<< '});
                    break;
                case 1:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_RESET  <<< '});
                    this.firmware = []
                    break;
                case 2:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_RST_CHKSM <<< '});
                    break;
                case 3:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_CHK_RUN <<< '});
                    this.firmwareChecksum = arrayChecksum(this.firmware)
                    winston.info({message: 'mock_jsonServer: CMD_CHK_RUN: calculated checksum: ' + this.firmwareChecksum + ' received checksum: ' + decToHex(cbusMsg.CPDTH, 2) + decToHex(cbusMsg.CPDTL, 2)});
                    if (this.firmwareChecksum == decToHex(cbusMsg.CPDTH, 2) + decToHex(cbusMsg.CPDTL, 2)) {
                        this.outputExtResponse(1)   // 1 = ok
                    } else {
                        this.outputExtResponse(0)   // 0 = not ok
                    }
                        break;
                case 4:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message CMD_BOOT_TEST <<< '});
                    this.outputExtResponse(2)   // 2 = confirm boot load
                    this.firmware = []
                    break;
                default:
                    winston.info({message: 'CBUS Network Sim: <<< Received control message UNKNOWN COMMAND ' + cbusMsg.text});
                    break
            }
            if(cbusMsg.CTLBT & (2**CTLBT_ACK))  {
              winston.info({message: 'mock_jsonServer: ACK requested : CTLBT ' + cbusMsg.CTLBT + ' ' + (2**CTLBT_ACK)});
              this.ackRequested = true
            }
          }
        if (cbusMsg.type == 'DATA') {
          for (var i = 0; i < 8; i++) {
            this.firmware.push(cbusMsg.data[i])
          }
          this.runningChecksum = arrayChecksum(cbusMsg.data, this.runningChecksum)
          winston.debug({message: 'mock_jsonServer: <<< Received DATA - new length ' + this.firmware.length});
            if(this.ackRequested){
              this.outputExtResponse(1)   // 1 = ok          
            }
        }
  
    }
    

//-------------------------------------------------------------------------------
// Output message routines, ordered by opcode
//-------------------------------------------------------------------------------

	// 21
	 outputKLOC(nodeNumber, session) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
		var msgData = cbusLib.encodeKLOC(session);
    this.broadcast(msgData)
	}


	// 50
	 outputRQNN(nodeNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
		var msgData = cbusLib.encodeRQNN(nodeNumber);
    this.broadcast(msgData)
	}
	

	// 52
	outputNNACK(nodeNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeNNACK(nodeNumber)
    this.broadcast(msgData)
	}
	

	// 59
	outputWRACK(nodeNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeWRACK(nodeNumber)
    this.broadcast(msgData)
	}
	

	// 60
	outputDFUN(nodeNumber, session, fn1, fn2) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeDFUN(session, fn1, fn2)
    this.broadcast(msgData)
	}


	// 63
	outputERR(nodeNumber, data1, data2, errorNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeERR(data1, data2, errorNumber)
    this.broadcast(msgData)
	}


	// 6F
	 outputCMDERR(nodeNumber, errorNumber) {
    winston.info({message: 'CBUS Network Sim: outputCMDERR : ' + nodeNumber + ' ' + errorNumber});
    var msgData = cbusLib.encodeCMDERR(nodeNumber, errorNumber)
    this.broadcast(msgData)
	}


	// 70
	 outputEVNLF(nodeNumber) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
      var msgData = cbusLib.encodeEVNLF(nodeNumber, this.getModule(nodeNumber).getFreeSpace())
      this.broadcast(msgData)
    }
	}

	// 90
	outputACON(nodeNumber, eventNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeACON(nodeNumber, eventNumber)
    this.broadcast(msgData)
	}


	// 91
	outputACOF(nodeNumber, eventNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeACOF(nodeNumber, eventNumber)
    this.broadcast(msgData)
	}


  // 93
  outputARON(nodeNumber, eventNumber) {
    // Format: [<MjPri><MinPri=3><CANID>]<93><NN hi><NN lo><EN hi><EN lo>
//		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeARON(nodeNumber, eventNumber);
    this.broadcast(msgData)
  }


	// 97
	outputNVANS(nodeNumber, nodeVariableIndex, nodeVariableValue) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
			var msgData = cbusLib.encodeNVANS(nodeNumber, nodeVariableIndex, nodeVariableValue)
			this.broadcast(msgData)
		}
	}


	// 98
	 outputASON(nodeNumber, deviceNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeASON(nodeNumber, deviceNumber)
    this.broadcast(msgData)
	}


	// 99
	 outputASOF(nodeNumber, deviceNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeASOF(nodeNumber, deviceNumber)
    this.broadcast(msgData)
	}

  // 9D
  outputARSON(nodeNumber, eventNumber) {
    // Format: [<MjPri><MinPri=3><CANID>]<9D><NN hi><NN lo><EN hi><EN lo>
    var msgData = cbusLib.encodeARSON(nodeNumber, eventNumber);
    this.broadcast(msgData)
  }


  // 9E
  outputARSOF(nodeNumber, eventNumber) {
    // Format: [<MjPri><MinPri=3><CANID>]<9E><NN hi><NN lo><EN hi><EN lo>
    var msgData = cbusLib.encodeARSOF(nodeNumber, eventNumber);
    this.broadcast(msgData)
  }



	// AB
	outputHEARTB(nodeNumber) {
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
		var msgData = cbusLib.encodeHEARTB(nodeNumber, 2, 3, 4);
		this.broadcast(msgData)
	}
	
	
	// AC - SD
  // SD Format: [<MjPri><MinPri=3><CANID>]<AC><NN hi><NN lo><ServiceIndex><ServiceType><ServiceVersion>
	//
	outputSD(nodeNumber) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
      // A special SD message is generated with the count of all the supported services
      var count = this.getModule(nodeNumber).getServiceCount();
      winston.debug({message: 'CBUS Network Sim:  service count ' + count});
      var msgData = cbusLib.encodeSD(nodeNumber, 0, 0, count);
      this.broadcast(msgData);
      winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
      // Now generate SD messages for all the supported services
      var services = this.getModule(nodeNumber).services;
      for (var key in services) {
        winston.debug({message: 'CBUS Network Sim:  service ' + JSON.stringify(services[key])});
        var msgData = cbusLib.encodeSD(nodeNumber, services[key]["ServiceIndex"], services[key]["ServiceType"], services[key]["ServiceVersion"]);
        this.broadcast(msgData);
			}
		}
    else {
      winston.warn({message: 'CBUS Network Sim:  ************ node number ' + nodeNumber + ' undefined ************'});
    }
	}


	// AF
	outputGRSP(nodeNumber, requestOpCode, serviceType, result) {
//		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
		var msgData = cbusLib.encodeGRSP(nodeNumber, requestOpCode, serviceType, result);
		this.broadcast(msgData)
	}
	
	// B6
	 outputPNN(module) {
		cbusLib.setCanHeader(2, module.CanId);
      var msgData = cbusLib.encodePNN(module.nodeNumber, 
        module.getManufacturerId(),
        module.getModuleId(),
        module.getFlags())
      this.broadcast(msgData)
	}
	
	// C7 - DGN
  // DGN Format: [<MjPri><MinPri=3><CANID>]<C7><NN hi><NN lo><ServiceIndex><DiagnosticCode><DiagnosticValue>
	//
	 outputDGN(nodeNumber, ServiceIndex, DiagnosticCode) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
			var services = this.getModule(nodeNumber).services;
      var serviceValid = false;
      var diagnosticCodeValid = false;
			for (var key in services) {
				if (ServiceIndex == 0){
          //
					// if ServiceIndex is 0 then do all services & all diagnostics
          //
          serviceValid = true;    // must be at least one service
  				winston.info({message: 'CBUS Network Sim:  serviceIndex ' + services[key].ServiceIndex});
          for (var code in services[key]["Diagnostics"]){
            diagnosticCodeValid = true;
            winston.info({message: 'CBUS Network Sim:  diagnostic ' + code});
            var msgData = cbusLib.encodeDGN(nodeNumber, services[key]["ServiceIndex"], code, services[key]["Diagnostics"][code]);
            this.broadcast(msgData);
        }
        } else if (ServiceIndex == services[key].ServiceIndex) {
          //
          // do all the diagnostics for the matching service if non-zero
          //
          winston.info({message: 'CBUS Network Sim:  outputDGN - service is valid  ' + services[key].ServiceIndex});
          serviceValid = true;    // must be matching service
          winston.info({message: 'CBUS Network Sim:  DGN single serviceIndex ' + services[key].ServiceIndex});
          for (var code in services[key].Diagnostics){
            var diagnosticValue = services[key].Diagnostics[code]
            winston.debug({message: 'CBUS Network Sim: DGN diagnosticCode ' + code + ' value ' + diagnosticValue});
            if (DiagnosticCode == 0) {
              diagnosticCodeValid = true;
              winston.info({message: 'CBUS Network Sim: diagnostic ' + code + ' value ' + diagnosticValue});
              var msgData = cbusLib.encodeDGN(nodeNumber, services[key].ServiceIndex, code, diagnosticValue);
              this.broadcast(msgData);
            } else {
              //
              // just do the single diagnostic for the single service
              //
              if (DiagnosticCode == code) {
                diagnosticCodeValid = true;
                winston.info({message: 'CBUS Network Sim: single diagnostic ' + code + ' value ' + diagnosticValue});
                var msgData = cbusLib.encodeDGN(nodeNumber, services[key].ServiceIndex, code, diagnosticValue);
                this.broadcast(msgData);
              }
            }
          }
        }
			}

      if (!serviceValid){
        // command was RDGN (0x87)
        winston.info({message: 'CBUS Network Sim:  outputDGN - Service invalid'});
        this.outputGRSP(nodeNumber, '87', 1, GRSP.InvalidService);
      } else if (!diagnosticCodeValid){
        // command was RDGN (0x87)
        winston.info({message: 'CBUS Network Sim:  outputDGN - DiagnosticCode invalid'});
        this.outputGRSP(nodeNumber, '87', 1, GRSP.InvalidDiagnosticCode);
      }
		}
	}


	// D3
	outputEVANS(nodeNumber, eventIdentifier, eventVariableIndex) {
    winston.info({message: 'CBUS Network Sim: EVANS : nodeNumber ' + nodeNumber + " eventIdentifier "+ eventIdentifier + " eventIndex " + eventVariableIndex});
    var eventNodeNumber = parseInt(eventIdentifier.substr(0, 4), 16);
    var eventNumber = parseInt(eventIdentifier.substr(4, 4), 16);
    if (this.getModule(this.learningNode) != undefined) {
      var event = this.getEventByName2(this.learningNode, eventIdentifier);
      if (event != undefined) {
        if (eventVariableIndex <= event.variables.length) {
          var eventVariableValue = event.variables[eventVariableIndex];
          var msgData = cbusLib.encodeEVANS(eventNodeNumber, eventNumber, eventVariableIndex, eventVariableValue)
          if ((eventVariableValue > 0) || (this.getModule(this.learningNode).sendZeroEV)){            
            this.broadcast(msgData)
          }
        } else {
          winston.info({message: 'CBUS Network Sim:  ************ event variable index exceeded ' + eventVariableIndex + ' ************'});
          this.outputCMDERR(nodeNumber, GRSP.InvalidEventVariableIndex)                    
        }
      }
    }
    else {
      winston.info({message: 'CBUS Network Sim:  ************ node number not valid ' + nodeNumber + ' ************'});
    }
	}
	
	//E2
	//[<MjPri><MinPri=3><CANID>]<E2><char1><char2><char3><char4><char5><char6><char7>
	outputNAME(nodeNumber, name) {
    cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
    var msgData = cbusLib.encodeNAME(name);
    this.broadcast(msgData);
	}
	

	// E7 - ESD
  // ESD Format: [<MjPri><MinPri=3><CANID>]<E7><NN hi><NN lo><ServiceIndex><Data1><Data2><Data3><Data4>
	//
	outputESD(nodeNumber, ServiceIndex) {
    var module = this.getModule(nodeNumber)
    var msgData = undefined
    if (module != undefined) {
			var services = module.services;
			for (var key in services) {
        if (ServiceIndex == services[key].ServiceIndex) {
          var msgData = cbusLib.encodeESD(nodeNumber, services[key].ServiceIndex, 1, 2, 3, 4);
        }
      }
    }
    if (msgData != undefined){
      this.broadcast(msgData);
      winston.info({message: 'CBUS Network Sim:  OUT>>  ' + msgData + " " + cbusLib.decode(msgData).text});
    } else {
          // command was RQSD (0x78)
          winston.info({message: 'CBUS Network Sim:  outputESD - serviceIndex invalid'});
          this.outputGRSP(nodeNumber, '78', 1, GRSP.InvalidService);
    }
	}


	// EF
	 outputPARAMS(nodeNumber) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
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
    }
	}
	
	//F2
  // eventIndex starts at 1
  // but events array is zero based, so subtract 1
	outputENRSP(nodeNumber, eventIndex) {
    if (this.getModule(nodeNumber) != undefined) {
      cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
      if (eventIndex > 0) {
        if (eventIndex <= this.getModule(nodeNumber).getStoredEventsCount()) {
          var events = this.getModule(nodeNumber).storedEvents;
          var eventName = events[eventIndex - 1].eventName
          var msgData = cbusLib.encodeENRSP(nodeNumber, eventName, eventIndex)
          this.broadcast(msgData)
        } else {
          winston.info({message: 'CBUS Network Sim:  ************ EVENT index exceeded ************'});
          this.outputCMDERR(nodeNumber, 7);
        }
      }
    }
	}


	// FC
	 outputUNSUPOPCODE(nodeNumber) {
		// Ficticious opcode - 'FC' currently unused 
		// Format: [<MjPri><MinPri=3><CANID>]<FC><NN hi><NN lo>
		cbusLib.setCanHeader(2, this.getModule(nodeNumber).CanId);
		var msgData = ':SB780N' + 'FC' + decToHex(nodeNumber, 4) + ';';     // don't have an encode for ficticious opcode
    this.broadcast(msgData)
	}


  async broadcast(msgData) {
    let outMsg = cbusLib.decode(msgData)
    this.writeBusTraffic('OUT>> ' + outMsg.text)
    winston.info({message: 'CBUS Network Sim: OUT >>> ' + msgData + " >>> " + outMsg.text});
    //await sleep(this.outDelay)
    this.clients.forEach(function (client) {
      client.write(msgData);
      winston.debug({message: 'CBUS Network Sim: Transmit >>>> Port: ' + client.remotePort 
        + ' Data: ' + msgData + " " + outMsg.text});
    });
  }

  
  outputExtResponse(value) {
    var msgData = cbusLib.encode_EXT_RESPONSE(value)
    this.broadcast(msgData)
  }

  writeBusTraffic(data){
    // use {flags: 'a'} to append and {flags: 'w'} to erase and write a new file
    var time = new Date()
    var timeStamp = String(time.getMinutes()).padStart(2, '0') + ':' 
      + String(time.getSeconds()).padStart(2, '0') + '.' 
      + String(time.getMilliseconds()).padStart(3, '0')
    this.busTrafficLogStream.write(timeStamp + ' ' + data + "\r\n");
  }



}

function sleep(timeout) {
	return new Promise(function (resolve, reject) {
		//here our function should be implemented 
    timeout =0
		setTimeout(()=>{
			resolve();
			;} , timeout
		);
	});
};
	


module.exports = {
    cbusNetworkSimulator: cbusNetworkSimulator
}



