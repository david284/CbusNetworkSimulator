const expect = require('chai').expect;
var winston = require('./config/winston_test.js');
var itParam = require('mocha-param');
const net = require('net')
const io = require('socket.io-client');

const simuator = require('./../CbusNetworkSimulator.js')

const NET_PORT = 5550;
const NET_ADDRESS = "127.0.0.1"

let network = new simuator.cbusNetworkSimulator(NET_PORT);

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

describe('cbusNetworkSimulator tests', function(){

	let testClient = undefined;


	before(function() {
		winston.info({message: ' '});
		winston.info({message: '======================================================================'});
		winston.info({message: '----------------------------- cbusNetworkSimulator tests -------------------------'});
		winston.info({message: '======================================================================'});
		winston.info({message: ' '});

        testClient = new net.Socket()
        testClient.connect(NET_PORT, NET_ADDRESS, function () {
			winston.debug({message: 'Client Connected'});
        })

	
	});

	after(function() {
		
	});
	


	it("QNN test", function (done) {
        network.clearSendArray();
        msgData_0D = ":SB780N0D" + ";";
    	testClient.write(msgData_0D);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData_0D);
			done();
		}, 100);
	})


	it("RQNP test", function (done) {
        network.clearSendArray();
        msgData_10 = ":SB780N10" + ";";
    	testClient.write(msgData_10);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData_10);
			done();
		}, 100);
	})


})