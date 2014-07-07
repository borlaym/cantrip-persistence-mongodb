var fs = require("fs");
_ = require("lodash");

module.exports = {
	setupPersistence: function() {
		var self = this;
		MongoClient.connect('mongodb://127.0.0.1:27017/cantrip', function(err, db) {
			if (err) throw err;
			self.data = db.collection(self.options.namespace);
		});
	},
	dataStore: {
		deleteNodes: function(path, callback) {
			this.data.remove({
				path: new RegExp(path + "/")
			}, function(err, res) {
				callback && callback(err, res);
			});
		},
		setNode: function(path, value, callback) {
			this.data.update({
				path: new RegExp(path)
			}, {
				value: value,
				path: path
			}, {
				upsert: true,
				safe: true
			}, function(err, docs) {
				err && console.log(err);
				callback && callback(err, docs);
			});
		},
		get: function(path, callback) {
			this.data.find({
				path: new RegExp(path)
			}, function(err, res) {

				if (err) {
					callback(err, null);
					return;
				}

				res.toArray(function(err, array) {

					if (err) {
						callback(err, null);
						return;
					}

					var result = {}; //This will hold the resulting object
					//Handle single ended queries, when all we return is a single value, an empty object or array
					if (array.length === 1 && path !== "") {
						if (array[0].value === "object") result = {};
						else if (array[0].value === "array") result = [];
						else result = {
							value: array[0].value
						}; //return a simple value: value object when the end result would be of a basic type
					}
					//Dig into the results. We loop through the nodes (objects) returned by the query
					for (var i = 0; i < array.length; i++) {
						var node = array[i]; //This is the current node in our json tree
						if (node.path.replace(path, "").substr(1) === "") {
							if (node.value === "array") result = []; //If the requested root node is an array, replace the base result variable with an empty array
							continue; //This is basically the first result. When we encounter it, we continue
						}
						var members = node.path.replace(path, "").substr(1).split("/"); //We omit the request path from the node's path attribute to get a relative reference, also strip the first / character
						var previousNode = null; //This is a pointer to the previous node
						var pointer = result; //This pointer will walk through our json object, searching for the place where the current node resides, so it can add a value to it
						//Loop through the nodes. foo/bar will become result.foo.bar
						for (var j = 0; j < members.length; j++) {
							previousNode = pointer; //This is a pointer to the previously checked node. Used for determining whether we're inside an array or an object
							if (j === members.length - 1) { //At the end of the pointer's walk, we add a value based on the node's value property
								if (node.value === "object") {
									if (_.isArray(previousNode)) previousNode.push({
										_id: members[j]
									});
									else pointer[members[j]] = {};
								} else if (node.value === "array") {
									if (_.isArray(previousNode)) previousNode.push([]);
									else pointer[members[j]] = [];
								} else {
									if (_.isArray(previousNode)) previousNode.push(node.value);
									else pointer[members[j]] = node.value;
								}
							} else {
								if (_.isArray(previousNode)) {
									//If the parent node was an array, we can't just use parent.current syntax, we need to find a member of the array by id (or index, in the case of simple arrays instead of collections)
									pointer = _.find(previousNode, function(obj) {
										return obj._id === members[j];
									});
								} else {
									//Set the pointer as parent.current
									pointer = pointer[members[j]];
								}
							}
						}
					}
					callback(null, result);
				});
			});
		},
		set: function(path, data, callback) {
			if (!_.isObject(data)) {
				this.setNode(path, data);
			} else {
				var self = this;
				var getKeys = function(obj, pointer) {
					for (var key in obj) {
						if (!_.isObject(obj[key])) {
							self.setNode(pointer + "/" + key, obj[key]);
							self.deleteNodes(pointer + "/" + key);
						} else {
							var keyToContinue = key;
							if (obj[key]._id) {
								keyToContinue = obj[key]._id;
							}
							if (_.isArray(obj[key])) self.setNode(pointer + "/" + key, "array");
							else {
								self.setNode(pointer + "/" + keyToContinue, "object");
							}
							getKeys(obj[key], pointer + "/" + keyToContinue);
						}
					}
				};
				getKeys(data, path);
			}
			callback(null, null);
		},
		delete: function(path, callback) {
			this.deleteNodes(path, function() {
				callback();
			});
		},
		parent: function(path, callback) {
			var parentPath = path.split("/").slice(0, -1).join("/");
			this.getNode(parentPath, function(err, res) {
				callback(err, res);
			});
		}
	}
}