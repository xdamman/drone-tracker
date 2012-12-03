var arDrone = require('ar-drone');
var client = arDrone.createClient("192.168.1.2");

client.createRepl();
