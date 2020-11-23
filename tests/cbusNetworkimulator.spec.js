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




})