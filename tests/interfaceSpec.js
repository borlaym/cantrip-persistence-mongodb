var Cantrip = require("Cantrip");
var mongoInterface = require("../index.js")

describe("This is a test suite for making sure the persistence interface works properly", function() {

	it("should set up properly", function(done) {
		Cantrip.options.port = 3001;
		Cantrip.options.namespace = "test" + Math.floor(Math.random() * 10000000000);
		Cantrip.options.persistence = mongoInterface;

		Cantrip.start(function() {
			expect(Cantrip.dataStore).toBeDefined();
			expect(Cantrip.dataStore.data).toBeDefined();
			done();
		});
	});

	describe("SET methods on root", function() {

		it("key1: simple value", function(done) {
			Cantrip.dataStore.set("/", {key1: "string"}, function(err, res) {
				Cantrip.dataStore.data.find({path: "/key1"}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res[0].path).toBe("/key1");
						expect(res[0].value).toBe("string");
						done();
					});
				});
			});
		});

		it("key2: empty array", function(done) {
			Cantrip.dataStore.set("/", {key2: []}, function(err, res) {
				Cantrip.dataStore.data.find({path: "/key2"}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res[0].path).toBe("/key2");
						expect(res[0].value).toBe("array");
						done();
					});
				});
			});
		});

		it("key3: empty object", function(done) {
			Cantrip.dataStore.set("/", {key3: {}}, function(err, res) {
				Cantrip.dataStore.data.find({path: "/key3"}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res[0].path).toBe("/key3");
						expect(res[0].value).toBe("object");
						done();
					});
				});
			});
		});

		it("key4: array with simple values", function(done) {
			Cantrip.dataStore.set("/", {key4: [1,2,3]}, function(err, res) {
				Cantrip.dataStore.data.find({path: new RegExp("/key4")}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res.length).toBe(4);
						expect(res[0].path).toBe("/key4");
						expect(res[0].value).toBe("array");
						expect(res[1].path).toBe("/key4/0");
						expect(res[1].value).toBe(1);
						done();
					});
				});
			});
		});

		it("key5: array with objects, accessed through their _id attributes", function(done) {
			Cantrip.dataStore.set("/", {key5: [{_id: "someID1", foo: "bar"}, {_id: "someID2", foo: "bar2"}]}, function(err, res) {
				Cantrip.dataStore.data.find({path: new RegExp("/key5")}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res.length).toBe(7);
						expect(res[0].path).toBe("/key5");
						expect(res[0].value).toBe("array");
						expect(res[1].path).toBe("/key5/someID1");
						expect(res[1].value).toBe("object");
						expect(res[2].path).toBe("/key5/someID1/_id");
						expect(res[2].value).toBe("someID1");
						expect(res[3].path).toBe("/key5/someID1/foo");
						expect(res[3].value).toBe("bar");
						expect(res[4].path).toBe("/key5/someID2");
						expect(res[4].value).toBe("object");
						done();
					});
				});
			});
		});

		it("key6: object with a simple key value pair", function(done) {
			Cantrip.dataStore.set("/", {key6: {foo: "bar"}}, function(err, res) {
				Cantrip.dataStore.data.find({path: new RegExp("/key6")}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res.length).toBe(2);
						expect(res[0].path).toBe("/key6");
						expect(res[0].value).toBe("object");
						expect(res[1].path).toBe("/key6/foo");
						expect(res[1].value).toBe("bar");
						done();
					});
				});
			});
		});

		it("key7: object with a nested object", function(done) {
			Cantrip.dataStore.set("/", {key7: {foo: {bar: "baz"}}}, function(err, res) {
				Cantrip.dataStore.data.find({path: new RegExp("/key7")}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res.length).toBe(3);
						expect(res[0].path).toBe("/key7");
						expect(res[0].value).toBe("object");
						expect(res[1].path).toBe("/key7/foo");
						expect(res[1].value).toBe("object");
						expect(res[2].path).toBe("/key7/foo/bar");
						expect(res[2].value).toBe("baz");
						done();
					});
				});
			});
		});

		it("key8: object with a nested array of objects", function(done) {
			Cantrip.dataStore.set("/", {key8: {foo: [{_id: "nestedID", bar: "baz"}]}}, function(err, res) {
				Cantrip.dataStore.data.find({path: new RegExp("/key8")}, function(err, res) {
					res.toArray(function(err, res) {
						expect(res.length).toBe(5);
						expect(res[0].path).toBe("/key8");
						expect(res[0].value).toBe("object");
						expect(res[1].path).toBe("/key8/foo");
						expect(res[1].value).toBe("array");
						expect(res[2].path).toBe("/key8/foo/nestedID");
						expect(res[2].value).toBe("object");
						expect(res[4].path).toBe("/key8/foo/nestedID/bar");
						expect(res[4].value).toBe("baz");
						done();
					});
				});
			});
		});

	});

});

module.exports = Cantrip;