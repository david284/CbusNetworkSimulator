const expect = require('chai').expect;
var winston = require('./config/winston_test.js');
var itParam = require('mocha-param');
const net = require('net')
const io = require('socket.io-client');
var cbusLib = require('cbusLibrary')

const simuator = require('./../CbusNetworkSimulator.js')
const cbusModules = require('./../modules.js')

var testModules = 	[
                new cbusModules.CANACC5(0),
                new cbusModules.CANACC8(1),
				new cbusModules.CANMIO_UNIVERSAL (65535),
                ]
                
for (var i = 0; i < testModules.length; i++) {
    testModules[i].setCanId(i+80);
}


const NET_PORT = 5550;
const NET_ADDRESS = "127.0.0.1"


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
			winston.debug({message: 'Client Connected'});
        })

        testClient.on('data', function (data) {
            const msgArray = data.toString().split(";");
  			for (var msgIndex = 0; msgIndex < msgArray.length - 1; msgIndex++) {
                msgArray[msgIndex] += ';'           // replace terminator removed by split function
                winston.info({message: 'Test client: data received ' + msgArray[msgIndex] + " " + cbusLib.decode(msgArray[msgIndex]).text});
                messagesIn.push(msgArray[msgIndex])
            }
        })
	})
    
    beforeEach (function() {
        network.clearSendArray();
        messagesIn = [];
        // ensure expected CAN header is reset before each test run
        cbusLib.setCanHeader(2, 60)
   		winston.info({message: ' '});   // blank line to separate tests
    })

	after(function() {
	});
	

    // 0D QNN
    //
	it("QNN test", function (done) {
        msgData = cbusLib.encodeQNN();
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
            expect(messagesIn.length).to.equal(network.modules.length), 'returned message count'; 
			done();
		}, 100);
	})


    // 10 RQNP
    //
	it("RQNP test", function (done) {
        msgData = cbusLib.encodeRQNP();
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})


    // 11 RQMN
    //
	it("RQMN test", function (done) {
        msgData = cbusLib.encodeRQMN();
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})


    // 21 KLOC
    //
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

	itParam("KLOC test session ${value.session}", GetTestCase_KLOC(), function (done, value) {
    	// Format: [<MjPri><MinPri=2><CANID>]<21><Session>
		winston.info({message: 'mergAdminNode test: BEGIN KLOC test ' + JSON.stringify(value)});
		expected = ":SA780N21" + decToHex(value.session, 2) + ";";
        network.outputKLOC(value.session)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
	})


    // 42 SNN
    //
	function GetTestCase_SNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("SNN test nodeNumber ${value.nodeNumber}", GetTestCase_SNN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN SNN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeSNN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
     		expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NNACK');
			done();
		}, 100);
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

	itParam("RQNN test nodeNumber ${value.nodeNumber}", GetTestCase_RQNN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN RQNN test ' + JSON.stringify(value)});
		expected = ":SB780N50" + decToHex(value.nodeNumber, 4) + ";";
        network.outputRQNN(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
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

	itParam("NNACK test nodeNumber ${value.nodeNumber}", GetTestCase_NNACK(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NNACK test ' + JSON.stringify(value)});
		expected = ":SB780N52" + decToHex(value.nodeNumber, 4) + ";";
        network.outputNNACK(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
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

	itParam("NNLRN test nodeNumber ${value.nodeNumber}", GetTestCase_NNLRN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NNLRN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNLRN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("NNULN test nodeNumber ${value.nodeNumber}", GetTestCase_NNULN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NNULN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNULN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("NNCLR test nodeNumber ${value.nodeNumber}", GetTestCase_NNCLR(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NNCLR test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNNCLR(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("NERD test nodeNumber ${value.nodeNumber}", GetTestCase_NERD(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NERD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNERD(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('ENRSP');
            }
			done();
		}, 100);
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

	itParam("RQEVN test nodeNumber ${value.nodeNumber}", GetTestCase_RQEVN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NERD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeRQEVN(value.nodeNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NUMEV');
            }
			done();
		}, 100);
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

	itParam("WRACK test nodeNumber ${value.nodeNumber}", GetTestCase_WRACK(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN WRACK test ' + JSON.stringify(value)});
		expected = ":SB780N59" + decToHex(value.nodeNumber, 4) + ";";
        network.outputWRACK(value.nodeNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
	})


    // 60 DFUN
    //
	function GetTestCase_DFUN () {
		var testCases = [];
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
					testCases.push({'session':session, 'Fn1':Fn1, 'Fn2':Fn2});
				}
			}
		}
		return testCases;
	}

	itParam("DFUN test session ${value.session} Fn1 ${value.Fn1} Fn2 ${value.Fn2}", GetTestCase_DFUN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN DFUN test ' + JSON.stringify(value)});
		expected = ":SA780N60" + decToHex(value.session, 2) + decToHex(value.Fn1, 2) + decToHex(value.Fn2, 2) + ";";
        network.outputDFUN(value.session, value.Fn1, value.Fn2)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
	})


    // 63 ERR
    //
	function GetTestCase_ERR () {
		var testCases = [];
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
                    testCases.push({'data1':data1, 'data2':data2, 'errorNumber':errorNumber});
                }
            }
		}
		return testCases;
	}

	itParam("ERR test data1 ${value.data1} data2 ${value.data2} errorNumber ${value.errorNumber}", GetTestCase_ERR(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN ERR test ' + JSON.stringify(value)});
		expected = ":SA780N63" + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.errorNumber, 2) + ";";
        network.outputERR(value.data1, value.data2, value.errorNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
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

	itParam("CMDERR test nodeNumber ${value.nodeNumber} errorNumber ${value.errorNumber}", GetTestCase_CMDERR(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN CMDERR test ' + JSON.stringify(value)});
		expected = ":SB780N6F" + decToHex(value.nodeNumber, 4) + decToHex(value.errorNumber, 2) + ";";
        network.outputCMDERR(value.nodeNumber, value.errorNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
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
				if (NVindex == 3) nvIndex = 255;
				testCases.push({'nodeId':nodeId, 'nvIndex':nvIndex});
			}
		}
		return testCases;
	}


	itParam("NVRD test nodeId ${value.nodeId} nvIndex ${value.nvIndex}", GetTestCase_NVRD(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN NVRD test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNVRD(value.nodeNumber, value.nvIndex);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NVANS');
            }
			done();
		}, 100);
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
				if (Pindex == 3) paramIndex = 255;
				testCases.push({'nodeId':nodeId, 'paramIndex':paramIndex});
			}
		}
		return testCases;
	}

	itParam("RQNPN test nodeId ${value.nodeId} paramIndex ${value.paramIndex}", GetTestCase_RQNPN(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN RQNPN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeRQNPN(value.nodeNumber, value.paramIndex);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
            if (messagesIn.length > 0) {
                expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('PARAN');
            }
			done();
		}, 100);
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


	itParam("NUMEV test nodeNumber ${value.nodeNumber} eventCount ${value.eventCount}", GetTestCase_NUMEV(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NUMEV test ' + JSON.stringify(value)});
		expected = ":SB780N74" + decToHex(value.nodeNumber, 4) + decToHex(value.eventCount, 2) + ";";
        network.outputNUMEV(value.nodeNumber, value.eventCount)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).mnemonic).to.equal('NUMEV');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, 100);
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

	itParam("ACON test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN ACON test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACON(value.nodeNumber, value.eventNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})

	itParam("ACON output test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN ACON test ' + JSON.stringify(value)});
		expected = ":SB780N90" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        network.outputACON(value.nodeNumber, value.eventNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
	})


	itParam("ACOF test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN ACOF test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACOF(value.nodeNumber, value.eventNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})


	itParam("ACOF output test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN ACOF test ' + JSON.stringify(value)});
		expected = ":SB780N91" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        network.outputACOF(value.nodeNumber, value.eventNumber)
		setTimeout(function(){
     		expect(messagesIn[0]).to.equal(expected);
			done();
		}, 100);
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

	itParam("EVULN test eventName ${value.eventName}", GetTestCase_EVULN(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN EVULN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeEVULN(value.eventName);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("NVSET test nodeId ${value.nodeId} nvIndex ${value.nvIndex} nvValue ${value.nvValue}", GetTestCase_NVSET(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN NVSET test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeNVSET(value.nodeId, value.nvIndex, value.nvValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("NVANS test nodeNumber ${value.nodeNumber} nvIndex ${value.nvIndex}", GetTestCase_NVANS(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN NVANS test ' + JSON.stringify(value)});
        network.outputNVANS(value.nodeNumber, value.nvIndex)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('97');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, 100);
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

	itParam("ASON test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber}", GetTestCase_ASONF(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN ACON test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeASON(value.nodeNumber, value.deviceNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})

	itParam("ASOF test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber}", GetTestCase_ASONF(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN ACOF test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACOF(value.nodeNumber, value.deviceNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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

	itParam("PARAN test nodeNumber ${value.nodeNumber} parameterIndex ${value.parameterIndex}", GetTestCase_PARAN(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN PARAN test ' + JSON.stringify(value)});
        network.outputPARAN(value.nodeNumber, value.parameterIndex)
		setTimeout(function(){
     		expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('9B');
     		expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
			done();
		}, 100);
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


	itParam("REVAL test nodeNumber ${value.nodeNumber} eventIndex ${value.eventIndex} eventValue ${value.eventValue}", GetTestCase_REVAL(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN REVAL test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeREVAL(value.nodeNumber, value.eventIndex, value.eventValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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
				if (ENindex == 1) eventIndex = 0;
				if (ENindex == 2) eventIndex = 1;
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

	itParam("NEVAL test nodeNumber ${value.nodeNumber} eventIndex ${value.eventIndex} eventVariableIndex ${value.eventVariableIndex}", 
        GetTestCase_NEVAL(), function (done, value) {
            winston.info({message: 'cbusMessage test: BEGIN NEVAL test ' + JSON.stringify(value)});
            network.outputNEVAL(value.nodeNumber, value.eventIndex, value.eventVariableIndex)
            setTimeout(function(){
                expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('B5');
                expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
                done();
            }, 100);
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


	itParam("EVLRN test eventName ${value.eventName} eventIndex ${value.eventIndex} eventValue ${value.eventValue}", GetTestCase_EVLRN(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN EVLRN test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeEVLRN(value.eventName, value.eventIndex, value.eventValue);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
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
                if (EVindex == 1) eventIndex = 0;
                if (EVindex == 2) eventIndex = 1;
                testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex});
            }
		}
		return testCases;
	}

	itParam("ENRSP test nodeNumber ${value.nodeNumber} eventName ${value.eventName} eventIndex ${value.eventIndex}", GetTestCase_ENRSP(), function (done, value) {
		winston.info({message: 'cbusMessage test: BEGIN ENRSP test ' + JSON.stringify(value)});
        // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
            network.outputENRSP(value.nodeNumber, value.eventIndex)
            setTimeout(function(){
                expect(cbusLib.decode(messagesIn[0]).opCode).to.equal('F2');
                expect(cbusLib.decode(messagesIn[0]).nodeNumber).to.equal(value.nodeNumber);
                done();
            }, 100);
    })



})