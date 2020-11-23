const expect = require('chai').expect;
var winston = require('./config/winston_test.js');
var itParam = require('mocha-param');
const net = require('net')
const io = require('socket.io-client');
var cbusLib = require('./../cbusLibrary.js')

const simuator = require('./../CbusNetworkSimulator.js')
const cbusModules = require('./../modules.js')

var testModules = 	[
                new cbusModules.CANACC5(0),
                new cbusModules.CANACC8(1),
				new cbusModules.CANMIO_UNIVERSAL (65535),
                ]





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

	itParam("ACOF test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (done, value) {
		winston.info({message: 'mergAdminNode test: BEGIN ACOF test ' + JSON.stringify(value)});
        msgData = cbusLib.encodeACOF(value.nodeNumber, value.eventNumber);
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
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






})