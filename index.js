var fs = require("fs");
_ = require("lodash");
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var ObjectID = mongo.ObjectID;

module.exports =  function(options) {
	options = _.extend({
		mongodb: {
			ip: "localhost",
			port: 27017,
			database: "cantrip"
		}
	}, options);

	return function(callback) {

		MongoClient.connect('mongodb://'+options.mongodb.ip+':'+options.mongodb.port+'/' + options.mongodb.database, function(err, db) {

			if (err) return callback && typeof callback === 'function' && callback(err);
			
			/**
			 * Return the datastore 
			 */
			return callback && typeof callback === 'function' && callback(null, {

				get: function(path, callback) {
					path = _.filter(path.split("/"), function(string) {
						return string !== "";
					});

					if (path.length === 0) {
						return callback && typeof callback === 'function' && callback({
							error: "Sorry, can't show you the whole database right now"
						}, node);
					
					}

					var collection = db.collection(path.shift());
					if (path.length === 0) {
						collection.find({}).toArray(function(err, docs) {
							_.map(docs, function(doc) {
								doc._id = doc._id.toString();
							})
							return callback && typeof callback === 'function' && callback(null, docs);
						});
					} else {

						var _id = ObjectID(path.shift());
						collection.findOne( { _id: _id }, function(err, doc) {
							console.log(err, doc);
							doc._id = doc._id.toString();

							if (path.length === 0) return callback && typeof callback === 'function' && callback(null, doc);

							var node = doc;
							//Loop through the data by the given paths
							for (var i = 0; i < path.length; i++) {
								var temp = node[path[i]];
								//If we found the given key, assign the node object to its value
								if (temp !== undefined) {
									node = node[path[i]];
									//If the given key doesn't exist, try the _id
								} else {
									temp = _.find(node, function(obj) {
										return obj._id === path[i];
									});
									//If it's not undefined, then assign it as the value
									if (temp !== undefined) {
										node = temp;
									} else {
										return callback && typeof callback === 'function' && callback({
											status: 404,
											error: "Requested node doesn't exist."
										}, null);
									}
								}
							}

							return callback && typeof callback === 'function' && callback(null, node);
						});	
					}

					
				},
				set: function(path, data, patch, callback) {
					var self = this;
					this.get(path, function(err, target) {
						if (_.isArray(target)) {
							//POST
							target.push(data);
							callback && typeof callback === 'function' && callback(null);
							syncData();
						} else if (_.isObject(target)) {
							//PATCH
							if (patch) {
								target = _.merge(target, data);
								callback && typeof callback === 'function' && callback(null);
								syncData();
							} else {
								//PUT
								self.parent(path, function(err, parent) {
									var toPut = _.last(path.split("/"));
									if (toPut === "") {
										_data = data;
									} else {
										parent[toPut] = data;
									}
									callback && typeof callback === 'function' && callback(null);
									syncData();
								});
							}
						} else {
							self.parent(path, function(err, parent) {
								parent[_.last(path.split("/"))] = data;
								callback && typeof callback === 'function' && callback(null);
								syncData();
							});
						}
					});
				},
				delete: function(path, callback) {
					var index = _.last(path.split("/"));
					this.parent(path, function(err, parent) {
						if (_.isArray(parent)) {
							if (_.isNumber(Number(index)) && !_.isNaN(Number(index))) {
								parent.splice(index, 1);
								//If it's a hash (string), we find the target object, get it's index and remove it from the array that way
							} else {
								var obj = _.find(parent, function(obj) {
									return obj._id === index;
								});
								parent.splice(_.indexOf(parent, obj), 1);
							}
						} else if (_.isObject(parent)) {
							delete parent[index];
						}
						callback && typeof callback === 'function' && callback(null);
						syncData();
					});
				},
				parent: function(path, callback) {
					this.get(path.split("/").slice(0, -1).join("/"), function(err, parent) {
						callback && typeof callback === 'function' && callback(err, parent);
					});
				}
			});
		});

	}
}