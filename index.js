var fs = require("fs");
_ = require("lodash");
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var ObjectID = mongo.ObjectID;

var ROOT_COLLECTION_NAME = "___root";


/**
 * Sets up the database as cantrip needs it. Ensures it has a ___root collection with a single document
 */
function initialSetup(db, callback) {

	if (!callback || typeof callback !== "function") throw new Error("No callback supplied for initialSetup()");

	db.collectionNames(function(err, colls) {
		
		if (err) {
			callback(err);
		}
		var root = _.find(colls, function(coll) {
			return coll.name === ROOT_COLLECTION_NAME;
		});

		if (root) {
			callback(null);
		} else {
			db.createCollection(ROOT_COLLECTION_NAME, function(err, collection) {

				if (err) {
					console.log(err);
					callback(err);
				}

				collection.insert({}, function(err, doc) {
					
					if (err) {
						console.log(err);
						callback(err);
					}

					callback(null);

				});
			});
		}
	});
}
/**
 * A collection of helper functions to handle different operations
 * @type {Object}
 */
var handlers = {
	get : {
		/**
		 * Get the root object, that consists of a special document in the ___root collection and the keys of all other collections
		 * @param  {[type]}   db       [description]
		 * @param  {Function} callback [description]
		 * @return {[type]}            [description]
		 */
		root: function(db, callback) {
			//Non-collection data on the root is stored in a dedicated collection as a single document
			var collection = db.collection(ROOT_COLLECTION_NAME);
			collection.find().toArray(function(err, docs) {
				if (err) {
					console.log(err);
					return callback(err);
				}

				docs = docs[0];
				delete docs._id; //We don't need the id parameter since it's not a real document

				db.collectionNames(function(err, colls) {
					if (err) {
						console.log(err);
						return callback(err);
					}
					colls = _.filter(colls, function(coll) {
						if (coll.name === ROOT_COLLECTION_NAME) return false;
						if (coll.name.indexOf("system.") > -1) return false;
						return true;
					});
					colls.forEach(function(coll) {
						docs[coll.name] = "[Collection]";
					});
					return callback(null, docs);
				});
			});
		},
		/**
		 * This function handles the case when the path doesn't point to a collection. We look for the target inside our special root document
		 * @param  {[type]}   db       [description]
		 * @param  {[type]}   path     [description]
		 * @param  {Function} callback [description]
		 */
		tryRoot: function(db, path, callback) {
			//Get the special root document
			var collection = db.collection(ROOT_COLLECTION_NAME);
			collection.find().toArray(function(err, docs) {
				if (err) {
					console.log(err);
					return callback(err);
				}

				docs = docs[0];
				delete docs._id; //We don't need the id parameter since it's not a real document
				var node = docs;
				//Since we know the target is not in a collection, we procceed by checking members of this object using the same method we use in jsonPersistence
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
							return callback({
								status: 404,
								error: "Requested node doesn't exist."
							}, null);
						}
					}
				}

				return callback(null, node);
			});
		},
		/**
		 * Try to find our target in one of the collections
		 * @param  {[type]}   db       [description]
		 * @param  {[type]}   path     [description]
		 * @param  {Function} foundCallback Called when the target was found
		 * @param { Function} notFoundCallback Called when our target was not found
		 */
		tryCollections: function(db, path, foundCallback, notFoundCallback) {
			var collection = db.collection(path[0]);
			//If the path only has one node, we want a whole collection
			if (path.length === 1) {
				collection.find({}).toArray(function(err, docs) {
					if (err) {
						console.log(err);
						return foundCallback(err);
					}
					if (docs.length === 0) {
						return notFoundCallback();
					}
					_.map(docs, function(doc) {
						doc._id = doc._id.toString();
					})
					return foundCallback(null, docs);
				});
			} else {
				//If more, try the second member of the path as an id
				try {
					var _id = ObjectID(path[1]);
				} catch(err) {
					//If it's not a valid mongo ID, we don't even try to look in a collection
					return notFoundCallback();
				}
				collection.findOne( { _id: _id }, function(err, doc) {
					if (err) {
						console.log(err);
						return foundCallback(err);
					}
					if (!doc) {
						return notFoundCallback();
					}
					doc._id = doc._id.toString();

					//If the request has 2 path members, it means we want the whole document
					if (path.length === 2) return foundCallback(null, doc);

					//If it has more, we try to find the target using the same method we use in jsonPersistence
					path = path.slice(2);
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
								return foundCallback({
									status: 404,
									error: "Requested node doesn't exist."
								}, null);
							}
						}
					}

					return foundCallback(null, node);
				});	
			}
		}
	}
}


module.exports =  function(options) {
	options = _.extend({
		mongodb: {
			ip: "localhost",
			port: 27017,
			database: "cantrip"
		}
	}, options);

	return function(callback) {

		if (!callback || typeof callback !== "function") throw new Error("No callback passed to mongoPersistence init.");

		MongoClient.connect('mongodb://'+options.mongodb.ip+':'+options.mongodb.port+'/' + options.mongodb.database, function(err, db) {

			if (err) return callback(err);
			
			initialSetup(db, function(err) {


				/**
				 * Return the datastore 
				 */
				return callback(null, {

					get: function(path, callback) {

						if (!callback || typeof callback !== "function") throw new Error("No callback passed to mongoPersistence.");

						//Get the elements of the request path so we can traverse the data tree
						path = _.filter(path.split("/"), function(string) {
							return string !== "";
						});

						//When the path length is zero, it means we got a request for the root
						if (path.length === 0) {

							return handlers.get.root(db, callback);
							
						} else {
							//If there is at least one path member, we first try to find our document in the collection identified by the first path member
							handlers.get.tryCollections(db, path, callback, function() {
								//If we had no success there, we try our special root document
								handlers.get.tryRoot(db, path, callback);
							});
						}


						
					},
					set: function(path, data, patch, callback) {
						var self = this;
						this.get(path, function(err, target) {
							if (_.isArray(target)) {
								//POST
								target.push(data);
								callback(null);
								syncData();
							} else if (_.isObject(target)) {
								//PATCH
								if (patch) {
									target = _.merge(target, data);
									callback(null);
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
										callback(null);
										syncData();
									});
								}
							} else {
								self.parent(path, function(err, parent) {
									parent[_.last(path.split("/"))] = data;
									callback(null);
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
							callback(null);
							syncData();
						});
					},
					parent: function(path, callback) {
						this.get(path.split("/").slice(0, -1).join("/"), function(err, parent) {
							callback(err, parent);
						});
					}
				});
			});

		});

	}
}