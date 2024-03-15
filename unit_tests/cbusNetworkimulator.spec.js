const expect = require('chai').expect;
var winston = require('./config/winston_test.js');
var itParam = require('mocha-param');
const net = require('net')
const io = require('socket.io-client');
var cbusLib = require('cbuslibrary')

const simuator = require('./../CbusNetworkSimulator.js')
const cbusModules = require('./../modules.js')

var testModules = 	[
                new cbusModules.CANVLCB(0),
                new cbusModules.CANTEST(1),
                new cbusModules.CANTEST(65535),
                ]

// set all the modules to use the same CanId to make checking easier                
for (var i = 0; i < testModules.length; i++) {
    testModules[i].CanId= 60;
}


const NET_PORT = 5550;
const NET_ADDRESS = "127.0.0.1"

const long_timeout = 100
const medium_timeout = 50
const short_timeout = 20

let network = new simuator.cbusNetworkSimulator(NET_PORT, testModules);

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

describe('cbusNetworkSimulator tests', function(){

	let testClient = undefined;
    let messagesIn = []

	before(function() {
		winston.info({message: ' '});
		winston.info({message: '======================================================================'});
		winston.info({message: '----------------------- cbusNetworkSimulator tests -------------------'});
		winston.info({message: '======================================================================'});
		winston.info({message: ' '});

        testClient = new net.Socket()
        testClient.connect(NET_PORT, NET_ADDRESS, function () {
			winston.debug({message: 'TEST: Client Connected at port ' + testClient.remotePort});
        })

        testClient.on('data', function (data) {
            const msgArray = data.toString().split(";");
  			for (var msgIndex = 0; msgIndex < msgArray.length - 1; msgIndex++) {
                msgArray[msgIndex] += ';'           // replace terminator removed by split function
                winston.info({message: 'TEST: Test client: data received ' + msgArray[msgIndex] + " " + cbusLib.decode(msgArray[msgIndex]).text});
                messagesIn.push(msgArray[msgIndex])
            }
        })
        
        testClient.on('end', function () {
            winston.info({message: 'TEST: Client Disconnected at port ' + testClient.remotePort});
        });
			

        testClient.on('error', function(err) {
            winston.info({message: 'TEST: Socket error ' + err});
        });

	})
    
    beforeEach (function() {
        network.clearSendArray();
        messagesIn = [];
		network.HEARTBenabled = false;		// prevent HEARTB affecting tests
        // ensure expected CAN header is reset before each test run
        cbusLib.setCanHeader(2, 60)
   		winston.info({message: ' '});   // blank line to separate tests
    })

	after(function(done) {
        testClient.end()
   		winston.info({message: ' '});                       // blank line to separate tests
   		winston.info({message: 'TEST: tests finished '});
        // bit of timing to ensure all winston messages get sent before closing tests completely
		setTimeout(function(){
            network.stopServer()
            setTimeout(function(){
                done();
            }, medium_timeout);
		}, medium_timeout);
    });
	

    // multiple clients
    //
	it("multiple client test", function (done) {
		winston.info({message: 'TEST: BEGIN multiple client test'});
    testClient2 = new net.Socket()
    testClient2.connect(NET_PORT, NET_ADDRESS)
    var secondClientData = ''
    testClient2.on('data', function (data) {
      secondClientData = data
      winston.info({message: 'TEST: Test client2: data received ' + data});
    })
    msgData = cbusLib.encodeQNN();
    setTimeout(function(){
      testClient.write(msgData);
    }, short_timeout);
    setTimeout(function(){
      expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
      expect(messagesIn.length).to.equal(network.modules.length), 'returned message count'; 
      expect(secondClientData.length).to.be.above(0, '2nd client data');
      setTimeout(function(){
        testClient2.end()
        done();
      }, long_timeout);
    }, long_timeout);
	})


    // 0D QNN
    //
	it("QNN test", function (done) {
		winston.info({message: 'TEST: BEGIN QNN test'});
        msgData = cbusLib.encodeQNN();
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
            expect(messagesIn.length).to.equal(network.modules.length), 'returned message count'; 
			done();
		}, medium_timeout);
	})


    // 10 RQNP
    //
	it("RQNP test", function (done) {
		winston.info({message: 'TEST: BEGIN RQNP test'});
    msgData = cbusLib.encodeRQNP();
		network.startSetup(testModules[0].nodeNumber);
		// Putting a module into setup will trigger an RQNN message to begin with - so expect two messages to be received
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            expect(messagesIn.length).to.equal(2), 'returned message count';
            network.endSetup(testModules[0]);
			done();
		}, medium_timeout);
	})


    // 11 RQMN
    //
	it("RQMN test", function (done) {
		winston.info({message: 'TEST: BEGIN RQMN test'});
        msgData = cbusLib.encodeRQMN();
		network.startSetup(testModules[0].nodeNumber);
		// Putting a module into setup will trigger an RQNN message to begin with - so expect two messages to be received
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
     		expect(cbusLib.decode(messagesIn[1]).mnemonic).to.equal('NAME');
            network.endSetup(testModules[0]);
			done();
		}, short_timeout);
	})


    // 21 KLOC
    //
    /*
	function GetTestCase_KLOC() {
		var testCases = [];
		for (S = 1; S < 4; S++) {
			if (S == 1) session = 0;
			if (S == 2) session = 1;
			if (S == 3) session = 255;
			testCases.push({'session':session});
		}
		return testCases;
	}
  */

	function GetTestCase_KLOC () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
        for (a2 = 1; a2 < 4; a2++) {
          if (a2 == 1) arg2 = 0;
          if (a2 == 2) arg2 = 1;
          if (a2 == 3) arg2 = 255;
          testCases.push({
            'nodeNumber':arg1, 
            'session':arg2
          });
        }
		}
		return testCases;
	}

	itParam("KLOC test ${JSON.stringify(value)}", GetTestCase_KLOC(), function (done, value) {
    	// Format: [<MjPri><MinPri=2><CANID>]<21><Session>
		winston.info({message: 'TEST: BEGIN KLOC test ' + JSON.stringify(value)});
		expected = ":SA780N21" + decToHex(value.session, 2) + ";";
        network.outputKLOC(value.nodeNumber, value.session)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 42 SNN
    //
	function GetTestCase_SNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			// note the reverse order of arguments, to ensure the test leaves the module as node 0
			if (NN == 1) nodeNumber = 65535;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 0;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("SNN test ${JSON.stringify(value)}", GetTestCase_SNN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN SNN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeSNN(value.nodeNumber);
		network.startSetup(testModules[0].nodeNumber);
		// Putting a module into setup will trigger an RQNN message to begin with - so expect two messages to be received
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			// message[0] will be RQNN, so test message [1]
     		expect(cbusLib.decode(messagesIn[1]).mnemonic).to.equal('NNACK');
            network.endSetup(testModules[0]);
			done();
		}, short_timeout);
	})


    // 4F NNRSM
    //
	function GetTestCase_NNRSM () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNRSM test ${JSON.stringify(value)}", GetTestCase_NNRSM(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNRSM test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNRSM(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('GRSP');
            }
			done();
		}, short_timeout);
	})


    // 50 RQNN
    //
	function GetTestCase_RQNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("RQNN test ${JSON.stringify(value)}", GetTestCase_RQNN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN RQNN test ' + JSON.stringify(value)});
		expected = ":SB780N50" + decToHex(value.nodeNumber, 4) + ";";
        network.outputRQNN(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 52 NNACK
    //
	function GetTestCase_NNACK () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNACK test ${JSON.stringify(value)}", GetTestCase_NNACK(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNACK test ' + JSON.stringify(value)});
		expected = ":SB780N52" + decToHex(value.nodeNumber, 4) + ";";
        network.outputNNACK(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 53 NNLRN
    //
	function GetTestCase_NNLRN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNLRN test ${JSON.stringify(value)}", GetTestCase_NNLRN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNLRN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNLRN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // 54 NNULN
    //
	function GetTestCase_NNULN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNULN test ${JSON.stringify(value)}", GetTestCase_NNULN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNULN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNULN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // 55 NNCLR
    //
	function GetTestCase_NNCLR () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNCLR test ${JSON.stringify(value)}", GetTestCase_NNCLR(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNCLR test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNCLR(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // 57 NERD
    //
	function GetTestCase_NERD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NERD test ${JSON.stringify(value)}", GetTestCase_NERD(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NERD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNERD(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('ENRSP');
            }
			done();
		}, medium_timeout);
	})


    // 58 RQEVN
    //
	function GetTestCase_RQEVN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("RQEVN test ${JSON.stringify(value)}", GetTestCase_RQEVN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NERD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeRQEVN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NUMEV');
            }
			done();
		}, short_timeout);
	})


    // 59 WRACK
    //
	function GetTestCase_WRACK () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("WRACK test ${JSON.stringify(value)}", GetTestCase_WRACK(), function (done, value) {
		winston.info({message: 'TEST: BEGIN WRACK test ' + JSON.stringify(value)});
		expected = ":SB780N59" + decToHex(value.nodeNumber, 4) + ";";
        network.outputWRACK(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 5E NNRST
    //
	function GetTestCase_NNRST () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNRST test ${JSON.stringify(value)}", GetTestCase_NNRST(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NNRST test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNRST(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('GRSP');
            }
			done();
		}, short_timeout);
	})


    // 60 DFUN
    //
	function GetTestCase_DFUN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
      for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
        if (sessionIndex == 1) session = 0;
        if (sessionIndex == 2) session = 1;
        if (sessionIndex == 3) session = 255;
        for (Fn1Index = 1; Fn1Index < 4; Fn1Index++) {
          if (Fn1Index == 1) Fn1 = 0;
          if (Fn1Index == 2) Fn1 = 1;
          if (Fn1Index == 3) Fn1 = 255;
          for (Fn2Index = 1; Fn2Index < 4; Fn2Index++) {
            if (Fn2Index == 1) Fn2 = 0;
            if (Fn2Index == 2) Fn2 = 1;
            if (Fn2Index == 3) Fn2 = 255;
            testCases.push({'nodeNumber':nodeNumber, 'session':session, 'Fn1':Fn1, 'Fn2':Fn2});
          }
        }
      }
    }
		return testCases;
	}

	itParam("DFUN test ${JSON.stringify(value)}", GetTestCase_DFUN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN DFUN test ' + JSON.stringify(value)});
		expected = ":SA780N60" + decToHex(value.session, 2) + decToHex(value.Fn1, 2) + decToHex(value.Fn2, 2) + ";";
        network.outputDFUN(value.nodeNumber, value.session, value.Fn1, value.Fn2)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 63 ERR
    //
	function GetTestCase_ERR () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
      for (D1 = 1; D1 < 4; D1++) {
        if (D1 == 1) data1 = 0;
        if (D1 == 2) data1 = 1;
        if (D1 == 3) data1 = 255;
        for (D2 = 1; D2 < 4; D2++) {
          if (D2 == 1) data2 = 0;
          if (D2 == 2) data2 = 1;
          if (D2 == 3) data2 = 255;
          for (errorIndex = 1; errorIndex < 4; errorIndex++) {
            if (errorIndex == 1) errorNumber = 0;
            if (errorIndex == 2) errorNumber = 1;
            if (errorIndex == 3) errorNumber = 255;
            testCases.push({'nodeNumber':nodeNumber, 'data1':data1, 'data2':data2, 'errorNumber':errorNumber});
          }
        }
      }
    }
		return testCases;
	}

	itParam("ERR test ${JSON.stringify(value)}", GetTestCase_ERR(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ERR test ' + JSON.stringify(value)});
		expected = ":SA780N63" + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.errorNumber, 2) + ";";
        network.outputERR(value.nodeNumber, value.data1, value.data2, value.errorNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 6F CMDERR
    //
	function GetTestCase_CMDERR () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (errorIndex = 1; errorIndex < 4; errorIndex++) {
				if (errorIndex == 1) errorNumber = 0;
				if (errorIndex == 2) errorNumber = 1;
				if (errorIndex == 3) errorNumber = 255;
				testCases.push({'nodeNumber':nodeNumber, 'errorNumber':errorNumber});
			}
		}
		return testCases;
	}

	itParam("CMDERR test ${JSON.stringify(value)}", GetTestCase_CMDERR(), function (done, value) {
		winston.info({message: 'TEST: BEGIN CMDERR test ' + JSON.stringify(value)});
		expected = ":SB780N6F" + decToHex(value.nodeNumber, 4) + decToHex(value.errorNumber, 2) + ";";
        network.outputCMDERR(value.nodeNumber, value.errorNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 71 NVRD
    //
	function GetTestCase_NVRD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeId = 0;
			if (NN == 2) nodeId = 1;
			if (NN == 3) nodeId = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 7;  // will get an error if it's too high for a module
				testCases.push({'nodeId':nodeId, 'nvIndex':nvIndex});
			}
		}
		return testCases;
	}


	itParam("NVRD test ${JSON.stringify(value)}", GetTestCase_NVRD(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NVRD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNVRD(value.nodeNumber, value.nvIndex);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NVANS');
            }
			done();
		}, long_timeout);
	})


    // 73 RQNPN
    //
	function GetTestCase_RQNPN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeId = 0;
			if (NN == 2) nodeId = 1;
			if (NN == 3) nodeId = 65535;
			for (Pindex = 1; Pindex < 4; Pindex++) {
				if (Pindex == 1) paramIndex = 0;
				if (Pindex == 2) paramIndex = 1;
				if (Pindex == 3) paramIndex = 7;
				testCases.push({'nodeId':nodeId, 'paramIndex':paramIndex});
			}
		}
		return testCases;
	}

	itParam("RQNPN test ${JSON.stringify(value)}", GetTestCase_RQNPN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN RQNPN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeRQNPN(value.nodeNumber, value.paramIndex);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('PARAN');
            }
			done();
		}, medium_timeout);
	})


    // 74 NUMEV
    //
	function GetTestCase_NUMEV () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (Pindex = 1; Pindex < 4; Pindex++) {
				if (Pindex == 1) eventCount = 0;
				if (Pindex == 2) eventCount = 1;
				if (Pindex == 3) eventCount = 255;
				testCases.push({'nodeNumber':nodeNumber, 'eventCount':eventCount});
			}
		}
		return testCases;
	}


	itParam("NUMEV test ${JSON.stringify(value)}", GetTestCase_NUMEV(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NUMEV test ' + JSON.stringify(value)});
		expected = ":SB780N74" + decToHex(value.nodeNumber, 4) + decToHex(value.eventCount, 2) + ";";
        network.outputNUMEV(value.nodeNumber, value.eventCount)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NUMEV');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})


    // 76 - MODE
    //
	function GetTestCase_MODE () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;		// setup mode
                if (a2 == 2) arg2 = 1;		// normal mode
                if (a2 == 3) arg2 = 2;		// learn mode
				testCases.push({'nodeNumber':arg1, 
					'ModeNumber':arg2});
            }
		}
		return testCases;
	}

	itParam("MODE test ${JSON.stringify(value)}", GetTestCase_MODE(), function (done, value) {
		winston.info({message: 'TEST: BEGIN MODE test ' + JSON.stringify(value)});
		expected = ":SB780N76" + decToHex(value.nodeNumber, 4) + decToHex(value.ModeNumber, 2) + ";";
        msgData = cbusLib.encodeMODE(value.nodeNumber, value.ModeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
			var hasTestPassed = false;
			// check data is written as expected
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
			//
			messagesIn.forEach(element => {
				var msg = cbusLib.decode(element);
				expect(msg.nodeNumber).to.equal(value.nodeNumber);
				if(msg.mnemonic == 'GRSP'){
					hasTestPassed = true;
				}
			});
			
			// now check mode has actually changed
			var module = network.getModule(value.nodeNumber);
			winston.info({message: 'TEST: Module inSetup() is ' + module.inSetupMode()});
			switch(value.ModeNumber){
				case 0:
					expect(module.inSetupMode()).to.be.true;
					break;
				case 1:
					expect(module.inSetupMode()).to.be.false;
					break;
			}
			expect(hasTestPassed).to.be.true;
			done();
		}, short_timeout);
	})


    // 78 RQSD
    //
		function GetTestCase_RQSD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber,
							'ServiceIndex':0 });
		}
		return testCases;
	}

    // RQSD Format: [<MjPri><MinPri=3><CANID>]<78><NN hi><NN lo><ServiceIndex>
	itParam("RQSD test  ${JSON.stringify(value)}", GetTestCase_RQSD(), function (done, value) {
		winston.info({message: 'TEST: BEGIN RQSD test'});
        msgData = cbusLib.encodeRQSD(value.nodeNumber, value.ServiceIndex);	// use "request all services" option
    	testClient.write(msgData);
		setTimeout(function(){
			// check data is written as expected
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
			//just check test client receives correct number of 'SD' messages
//            expect(messagesIn.length).to.equal(3), 'returned message count'; 
     		expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('SD');
     		expect(cbusLib.decode(messagesIn[1]).mnemonic).to.equal('SD');
     		expect(cbusLib.decode(messagesIn[2]).mnemonic).to.equal('SD');
			done();
		}, short_timeout);
	})


    // 87 RDGN
    //
		function GetTestCase_RDGN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

    // RDGN Format: [<MjPri><MinPri=3><CANID>]<87><NN hi><NN lo><ServiceIndex><DiagnosticCode>
	itParam("RDGN test ${JSON.stringify(value)}", GetTestCase_RDGN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN RDGN test'});
        msgData = cbusLib.encodeRDGN(value.nodeNumber, 0, 0);	// use "request all Diagnostics" option
    	testClient.write(msgData);
		setTimeout(function(){
			// check data is written as expected
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
			//just check test client receives correct number of 'DGN' messages
//            expect(messagesIn.length).to.equal(3), 'returned message count'; 
     		expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('DGN');
     		expect(cbusLib.decode(messagesIn[1]).mnemonic).to.equal('DGN');
     		expect(cbusLib.decode(messagesIn[2]).mnemonic).to.equal('DGN');
			done();
		}, 30);
	})


    // 90 & 91 ACON & ACOF
    //
	function GetTestCase_ACONF () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (EVindex = 1; EVindex < 4; EVindex++) {
				if (EVindex == 1) eventNumber = 0;
				if (EVindex == 2) eventNumber = 1;
				if (EVindex == 3) eventNumber = 65535;
				testCases.push({'nodeNumber':nodeNumber, 'eventNumber':eventNumber});
			}
		}
		return testCases;
	}

	itParam("ACON test ${JSON.stringify(value)}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACON test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACON(value.nodeNumber, value.eventNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})

	itParam("ACON output test ${JSON.stringify(value)}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACON test ' + JSON.stringify(value)});
		expected = ":SB780N90" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        network.outputACON(value.nodeNumber, value.eventNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


	itParam("ACOF test ${JSON.stringify(value)}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACOF test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACOF(value.nodeNumber, value.eventNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


	itParam("ACOF output test ${JSON.stringify(value)}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACOF test ' + JSON.stringify(value)});
		expected = ":SB780N91" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        network.outputACOF(value.nodeNumber, value.eventNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, short_timeout);
	})


    // 95 EVULN
    //
	function GetTestCase_EVULN () {
		var testCases = [];
		for (EV = 1; EV < 4; EV++) {
			if (EV == 1) eventName = '00000000';
			if (EV == 2) eventName = '00000001';
			if (EV == 3) eventName = 'FFFFFFFF';
			testCases.push({'eventName':eventName});
		}
		return testCases;
	}

	itParam("EVULN test ${JSON.stringify(value)}", GetTestCase_EVULN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN EVULN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeEVULN(value.eventName);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})

    // 96 NVSET
    //
	function GetTestCase_NVSET () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeId = 0;
			if (NN == 2) nodeId = 1;
			if (NN == 3) nodeId = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 255;
				for (NVvalue = 1; NVvalue < 4; NVvalue++) {
					if (NVvalue == 1) nvValue = 0;
					if (NVvalue == 2) nvValue = 1;
					if (NVvalue == 3) nvValue = 255;
					testCases.push({'nodeId':nodeId, 'nvIndex':nvIndex, 'nvValue':nvValue});
				}
			}
		}
		return testCases;
	}

	itParam("NVSET test ${JSON.stringify(value)}", GetTestCase_NVSET(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NVSET test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNVSET(value.nodeId, value.nvIndex, value.nvValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // 97 NVANS
    //
	function GetTestCase_NVANS () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 2;
				testCases.push({'nodeNumber':nodeNumber, 'nvIndex':nvIndex});
			}
		}
		return testCases;
	}

	itParam("NVANS test ${JSON.stringify(value)}", GetTestCase_NVANS(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NVANS test ' + JSON.stringify(value)});
        network.outputNVANS(value.nodeNumber, value.nvIndex)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('97');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})


    // 98 & 99 ACON & ACOF
    //
	function GetTestCase_ASONF () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (DN = 1; DN < 4; DN++) {
				if (DN == 1) deviceNumber = 0;
				if (DN == 2) deviceNumber = 1;
				if (DN == 3) deviceNumber = 65535;
				testCases.push({'nodeNumber':nodeNumber, 'deviceNumber':deviceNumber});
			}
		}
		return testCases;
	}

	itParam("ASON test ${JSON.stringify(value)}", GetTestCase_ASONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACON test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeASON(value.nodeNumber, value.deviceNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})

	itParam("ASOF test ${JSON.stringify(value)}", GetTestCase_ASONF(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ACOF test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACOF(value.nodeNumber, value.deviceNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // 9B PARAN
    //
	function GetTestCase_PARAN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (PI = 1; PI < 4; PI++) {
				if (PI == 1) parameterIndex = 0;
				if (PI == 2) parameterIndex = 1;
				if (PI == 3) parameterIndex = 8;
				testCases.push({'nodeNumber':nodeNumber, 'parameterIndex':parameterIndex});
			}
		}
		return testCases;
	}

	itParam("PARAN test ${JSON.stringify(value)}", GetTestCase_PARAN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN PARAN test ' + JSON.stringify(value)});
        network.outputPARAN(value.nodeNumber, value.parameterIndex)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('9B');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})


    // 9C REVAL
    //
	function GetTestCase_REVAL () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeId = 0;
			if (NN == 2) nodeId = 1;
			if (NN == 3) nodeId = 65535;
			for (EVindex = 1; EVindex < 4; EVindex++) {
				if (EVindex == 1) eventIndex = 0;
				if (EVindex == 2) eventIndex = 1;
				if (EVindex == 3) eventIndex = 255;
				for (EVvalue = 1; EVvalue < 4; EVvalue++) {
					if (EVvalue == 1) eventValue = 0;
					if (EVvalue == 2) eventValue = 1;
					if (EVvalue == 3) eventValue = 255;
					testCases.push({'nodeNumber':nodeId, 'eventIndex':eventIndex, 'eventValue':eventValue});
				}
			}
		}
		return testCases;
	}


	itParam("REVAL test ${JSON.stringify(value)}", GetTestCase_REVAL(), function (done, value) {
		winston.info({message: 'TEST: BEGIN REVAL test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeREVAL(value.nodeNumber, value.eventIndex, value.eventValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})

  // AB HEARTB
  //
	function GetTestCase_HEARTB () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
				testCases.push({'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("HEARTB test ${JSON.stringify(value)}",  GetTestCase_HEARTB(), function (done, value) {
		winston.info({message: 'TEST: BEGIN HEARTB test ' + JSON.stringify(value)});
		network.outputHEARTB(value.nodeNumber)
		setTimeout(function(){
			expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('AB');
			expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})
    

    // AC SD
    //
	function GetTestCase_SD () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
				testCases.push({'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("SD test ${JSON.stringify(value)}",  GetTestCase_SD(), function (done, value) {
		winston.info({message: 'TEST: BEGIN SD test ' + JSON.stringify(value)});
		network.outputSD(value.nodeNumber)
		setTimeout(function(){
			expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('AC');
			expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})
    

    // B5 NEVAL
    //
	function GetTestCase_NEVAL () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (ENindex = 1; ENindex < 3; ENindex++) {
				if (ENindex == 1) eventIndex = 1;
				if (ENindex == 2) eventIndex = 2;
                for (EVindex = 1; EVindex < 4; EVindex++) {
                    if (EVindex == 1) eventVariableIndex = 0;
                    if (EVindex == 2) eventVariableIndex = 1;
                    if (EVindex == 3) eventVariableIndex = 2;
                    testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex, 'eventVariableIndex':eventVariableIndex});
                }
			}
		}
		return testCases;
	}

	itParam("NEVAL test ${JSON.stringify(value)}", GetTestCase_NEVAL(), function (done, value) {
		winston.info({message: 'TEST: BEGIN NEVAL test ' + JSON.stringify(value)});
		network.outputNEVAL(value.nodeNumber, value.eventIndex, value.eventVariableIndex)
		setTimeout(function(){
			expect(messagesIn.length).to.be.above(0);
			expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('B5');
			expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, short_timeout);
	})
	
	
    // C7 DGN
    //
	function GetTestCase_DGN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("DGN test ${JSON.stringify(value)}", GetTestCase_DGN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN DGN test ' + JSON.stringify(value)});
		//only do special case of request 'all' diagnostics from all services from node
		network.outputDGN(value.nodeNumber, 0, 0)
		setTimeout(function(){
			var msgCount = 0;
			messagesIn.forEach(element => {
				var msg = cbusLib.decode(element);
				expect(msg.mnemonic).to.equal('DGN');
				expect(msg.nodeNumber).to.equal(value.nodeNumber);
				msgCount++;
			})
			winston.info({message: 'TEST: DGN test ' + msgCount + ' messages received'});
			winston.info({message: 'TEST: DGN test end'});
			done();
		}, short_timeout);
	})
    

    

    // D2 - EVLRN
    //
	function GetTestCase_EVLRN () {
		var testCases = [];
		for (EV = 1; EV < 4; EV++) {
			if (EV == 1) eventName = '00000000';
			if (EV == 2) eventName = '00000001';
			if (EV == 3) eventName = 'FFFFFFFF';
			for (EVindex = 1; EVindex < 4; EVindex++) {
				if (EVindex == 1) eventIndex = 0;
				if (EVindex == 2) eventIndex = 1;
				if (EVindex == 3) eventIndex = 255;
				for (EVvalue = 1; EVvalue < 4; EVvalue++) {
					if (EVvalue == 1) eventValue = 0;
					if (EVvalue == 2) eventValue = 1;
					if (EVvalue == 3) eventValue = 255;
					testCases.push({'eventName':eventName, 'eventIndex':eventIndex, 'eventValue':eventValue});
				}
			}
		}
		return testCases;
	}


	itParam("EVLRN test ${JSON.stringify(value)}", GetTestCase_EVLRN(), function (done, value) {
		winston.info({message: 'TEST: BEGIN EVLRN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeEVLRN(value.eventName, value.eventIndex, value.eventValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, short_timeout);
	})


    // F2 ENRSP
    //
	function GetTestCase_ENRSP () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
            for (EVindex = 1; EVindex < 3; EVindex++) {
                if (EVindex == 1) eventIndex = 1;
                if (EVindex == 2) eventIndex = 2;
                testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex});
            }
		}
		return testCases;
	}

	itParam("ENRSP test ${JSON.stringify(value)}", GetTestCase_ENRSP(), function (done, value) {
		winston.info({message: 'TEST: BEGIN ENRSP test ' + JSON.stringify(value)});
        // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
            network.outputENRSP(value.nodeNumber, value.eventIndex)
            setTimeout(function(){
                expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('F2');
                expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
                done();
            }, short_timeout);
    })


//
// Extended ID messages
//

    // PUT CONTROL
    //
	function GetTestCase_PUT_CONTROL () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = '000000';
			if (a1 == 2) arg1 = '000001';
			if (a1 == 3) arg1 = 'FFFFFF';
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 255;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        for (a5 = 1; a5 < 4; a5++) {
                            if (a5 == 1) arg5 = 0;
                            if (a5 == 2) arg5 = 1;
                            if (a5 == 3) arg5 = 255;
                            for (a6 = 1; a6 < 4; a6++) {
                                if (a6 == 1) arg6 = 0;
                                if (a6 == 2) arg6 = 1;
                                if (a6 == 3) arg6 = 255;
                                testCases.push({'address':arg1, 
                                    'RESVD':arg2, 
                                    'CTLBT':arg3, 
                                    'SPCMD':arg4, 
                                    'CPDTL':arg5, 
                                    'CPDTH':arg6});
                            }
                        }
                    }
                }
            }
		}
		return testCases;
	}


    // EXT_PUT_CONTROL test
    //
	itParam("EXT_PUT_CONTROL test ${JSON.stringify(value)}", GetTestCase_PUT_CONTROL(), function (done, value) {
		winston.info({message: 'TEST: BEGIN EXT_PUT_CONTROL test ' + JSON.stringify(value)});
		msgData = ":X00080000N" + value.address + decToHex(value.RESVD, 2) + decToHex(value.CTLBT, 2) + decToHex(value.SPCMD, 2) + decToHex(value.CPDTL, 2) + decToHex(value.CPDTH, 2) + ";";
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
			done();
		}, short_timeout);
    })



    // EXT_RESPONSE test cases
    //
	function GetTestCase_EXT_RESPONSE () {
		var testCases = [];
		for (a1 = 1; a1 < 3; a1++) {
			if (a1 == 1) { arg1 = 3; arg2 = 1;}
			if (a1 == 2) { arg1 = 4; arg2 = 2;}
            testCases.push({'SPCMD': arg1, 'response': arg2});
        }
		return testCases;
	}


    // EXT_RESPONSE test
    //
	itParam("EXT_RESPONSE test ${JSON.stringify(value)}", GetTestCase_EXT_RESPONSE(), function (done, value) {
		winston.info({message: 'TEST: BEGIN EXT_PUT_CONTROL test ' + JSON.stringify(value)});
		msgData = ":X00080000N" + '0000000101' + decToHex(value.SPCMD, 2) + '0000' + ";";
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
     		expect(cbusLib.decode(messagesIn[0]).response).to.equal(value.response, 'response');
			done();
		}, short_timeout);
    })
})