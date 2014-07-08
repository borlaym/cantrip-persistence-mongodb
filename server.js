var Cantrip = require("Cantrip");
var mongodb = require("./index.js");

Cantrip.options.persistence = mongodb;
Cantrip.options.port = 3000;

Cantrip.start();