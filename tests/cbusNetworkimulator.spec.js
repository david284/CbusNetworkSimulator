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
    let incomingMessages = []

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
                incomingMessages.push(msgArray[msgIndex])
                winston.info({message: 'Test client: data received ' + msgArray[msgIndex]});
            }
        })
	})

	after(function() {
		
	});
	

    // 0D QNN
    //
	it("QNN test", function (done) {
        network.clearSendArray();
        incomingMessages = [];
        msgData = ":SB780N0D" + ";";
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData, ' sent message');
            expect(incomingMessages.length).to.equal(network.modules.length), 'returned message count'; 
			done();
		}, 100);
	})


    // 10 RQNP
    //
	it("RQNP test", function (done) {
        network.clearSendArray();
        msgData = ":SB780N10" + ";";
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})


    // 11 RQMN
    //
	it("RQMN test", function (done) {
        network.clearSendArray();
        msgData = ":SB780N11" + ";";
    	testClient.write(msgData);
		setTimeout(function(){
     		expect(network.getSendArray()[0]).to.equal(msgData);
			done();
		}, 100);
	})


})