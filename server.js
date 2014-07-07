var Cantrip = require("Cantrip");
var mongodb = require("./index.js");

Cantrip.options.persistence = mongodb;

Cantrip.start();