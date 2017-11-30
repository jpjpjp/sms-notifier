/*
 * member-list.js
 * 
 * This module provides the interface to read/write to the list of members
 * It uses a mongo database for persistent storage but this could be replaced
 * 
 * Ran into wierd issues with mongo promises so have reverted to callbacks 11/25/17
*/
/* eslint-disable no-console */

var debug = require('debug')('MemberList');

// Keep track about "stuff" I learn from the users in a hosted Mongo DB
var mongo_client = require('mongodb').MongoClient;
var mConfig = {};
if ((process.env.MONGO_DB_USER) && (process.env.MONGO_DB_PASSWORD)) {
  mConfig.mongoUser = process.env.MONGO_DB_USER;
  mConfig.mongoPass = process.env.MONGO_DB_PASSWORD;
  mConfig.mongoUrl = process.env.MONGO_URL;
  mConfig.mongoDb = process.env.MONGO_DB;
  mConfig.mongoCollectionName = process.env.MONGO_DB_COLLECTION;
  mConfig.collection = null;
} else {
  console.error('Cant find details for Database');
}
//var mongoUri = 'mongodb://'+mConfig.mongoUser+':'+mConfig.mongoPass+'@'+mConfig.mongoUrl+mConfig.mongoDb+'?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';
var mongoUri = 'mongodb://'+mConfig.mongoUser+':'+mConfig.mongoPass+'@'+mConfig.mongoUrl

/* Example Mongo Usage from tropo-usage-bot
if (mCollection) {
  mCollection.findOne({'_id': bot.isDirectTo}, function(err, reply){
    if (err) {return console.log("Can't communicate with db:" + err.message);}
    if (reply !== null) {
      flint.debug('User config exists in DB, so this is an existing room.  Bot has restarted.');
      newUser = reply;
    } else {
      flint.debug("This is a new room.  Storing data about this user");
      newUser._id = bot.isDirectTo;
      mCollection.insert(newUser, {w:1}, function(err, result) {
        if (err) {return console.log("Can't add new user "+bot.isDirectTo+" to db:" + err.message);}
      });
    }
*/

class MemberList {
  /**
   * MemberList object constructor.  Connects to a mongoDB based on environment.
   *   Optionally, calls a callback to inform creator that db is ready
   *
   * @function updateMemberListFromDb
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an array of member objects populated from the db
   */
  constructor(cb) {
    // maintain an in memory copy of the member list
    // TODO figure out how to make this work for LARGE lists that can't all be in memory
    this.memberList = [];
    mongo_client.connect(mongoUri, function(err, db) {
      if (err) {return console.log('Error connecting to Mongo '+ err.message);}
      db.collection(mConfig.mongoCollectionName, {strict:true}, function(err, collection) {
        if (err) {
          if (cb) {
            return cb(err);
          } else {
            return console.log('Error getting Mongo collection  '+ err.message);}
          }
        mConfig.collection = collection;
        // Optimize lookups of Admins
        collection.ensureIndex('isAdmin');
        let successMsg = 'Database connection for persistent storage is ready.';
        if (cb) {cb(null, successMsg);}
      });
    });
  }

  /**
   * (re)creates the in-memory member list from the database version
   * This is stored as array of JSON Objects.  Each member JSON contains
   * TODO
   *
   * @function updateMemberListFromDb
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an array of member objects populated from the db
   */
  updateMemberListFromDb(cb) {
    let that = this;
    if (mConfig.collection) {
      // Perform a simple find and return all the documents
      mConfig.collection.find().toArray(function(err, list) {
        if (err){
          return cb({status: 500, message: e.message});
        }
        that.memberList = list;
        return cb(null, that.memberList);
      });
    } else {
      return cb(null, {status: 200, message: 'Database not avaialble'});
    }
  }

  /**
   * Returns the in-memory member list to send to a client
   *
   * @function getMemberList
   * @returns {array} -- an array of member objects populated from the db
   */
  getMemberList() {    
    return this.memberList;
  }

  /**
   * Returns the list of Admins
   *
   * @function getAdminList
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an array of member objects populated from the db
   */
  getAdminList(cb) {    
    if (mConfig.collection) {
      mConfig.collection.find({'isAdmin': 'true'}).toArray(function (err, list) {
        if (err) {
          return cb(err);
        } else {
          console.log('find admins returned: '+list.length);
          return cb(null, list);
        }
      });
    } else {
      return cb(new Error('Database not ready'));
    }
  }

  /**
   * Returns details for a particular phone number
   *
   * @function getMember
   * @param {string} - number of the member we want info for
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an array of member objects populated from the db
   */
  getMember(number, cb) {    
    if (mConfig.collection) {
      mConfig.collection.findOne({_id: number}, function (err, member) {
        if (err) {
          return cb(err);
        } else {
          return cb(null, member);
        }
      });
    } else {
      return cb(new Error('Database not ready'));
    }
  }
  /**
   * Adds a new member to the in memory and database version of the member list
   *
   * @function addMember
   * @param {Object} member - JSON object with new member info
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an object with a status code and a message with the number of members available
   */
  addMember(member, cb) {
    // validate that member is propoerly formed.....
    const newMember = member;
    let that = this;
    
    if ((typeof newMember.number === 'undefined') || (typeof newMember.firstName === 'undefined') ||
    (typeof newMember.lastName === 'undefined') || (typeof newMember.isAdmin === 'undefined')){
      //return reject({status: 400, message: 'Invalid Member Object'});        
      return cb(null, {status: 400, message: 'Invalid Member Object'}, null);        
    }
    if (mConfig.collection) {
    mConfig.collection.insertOne(newMember, function (err, res) {
      if (err) {
        return cb(null, {status: 500, message: err.message});
      } else {
        console.log('insertOne returned:');
        console.log(res);
        that.memberList.push(newMember);
        return cb(null, {status: 200, 
          message: 'Added member succesfully.  Current number of members: ' + that.memberList.length});
      }
      });
    } else {
      return cb(null, {status: 500, message: 'Database not available'});
    }
  }
  
  /**
   * Sets the optOut flag for a given member
   *
   * @function setOptOutStatus
   * @param {string} number - Number of member to set
   * @param {boolean} status - true or false
   * @param {callback} - callback when list has been updated from db
   * 
   */
  setOptOut(number, status, cb) {
    let that = this;
    if (mConfig.collection) {
      mConfig.collection.update({_id: number}, {$set: {'optOut': status}}, function (err, res) {
        if (err){
          console.error(err.message);
          return cb(err);
        }
        if ((res.result.ok) && (res.result.n > 0)) {
          return cb(null, {status: 200, 
            message: 'Opt Out flag set succesfully: '+status});            
        } else {
          return cb(new Error('Could not find member info for phone number: '+number));
        }
      });
    } else {
      return cb(new Error('Database not avaialble'));
    }
  }

  /**
   * Updates one of more fileds existing member both in-memory and in the DB and list
   *
   * @function updateMember
   * @param {Object} member - JSON object with new member info
   * @param {callback} - callback when list has been updated from db
   * @returns {object} -- an object with an appropriate http response code and message
   * 
   */
  updateMember(member, cb) {
    const newMember = member;
    let that = this;
    if (typeof newMember._id === 'undefined') {
      return cb(null, {status: 400, message: 'Invalid Member Object'});        
    }
    if (mConfig.collection) {
      mConfig.collection.findOneAndUpdate({_id: newMember._id}, newMember, function (err, res) {
        if (err){
          console.error(err.message);
          return cb(null, {status: 500, message: e.message});
        }
        console.log('findOneAndUpdate returned:');
        console.log(res);
        let i = that.findWithAttr(that.memberList, '_id', newMember._id);
        if (i >= 0) {
            that.memberList.splice(i,1);
            that.memberList.push(newMember);
        }
        return cb(null, {status: 200, 
          message: 'Member Updated succesfully.  Current number of members: ' + that.memberList.length});
      });
    } else {
      return cb(null, {status: 200, message: 'Database not avaialble'});
    }
  }

  /**
   * Deletes a member from our list
   *
   * @function deleteMember
   * @param {Object} member - JSON object with new member info
   * @param {callback} - callback when list has been updated from db
   * @returns {object} -- an object with an appropriate http response code and message
   */
  deleteMember(member, cb) {
    // validate that member is propoerly formed.....
    const newMember = member;
    let that = this;
    if (typeof newMember._id === 'undefined') {
      return cb(null, {status: 400, message: 'Invalid Member Object'});        
    }
    if (mConfig.collection) {
      mConfig.collection.deleteOne({_id: newMember._id}, function(err, res) {
        if (err) {
          return cb(null, {status: 500, message: e.message});          
        }
        console.log('deleteOne returned:');
        console.log(res);
        let i = that.findWithAttr(that.memberList, '_id', newMember._id);
        if (i >= 0) {
            that.memberList.splice(i,1);
        }
        return cb(null, {status: 200, 
          message: 'Member deleted succesfully.  Current number of members: ' + that.memberList.length});
      });
    } else {
      return cb(null, {status: 200, message: 'Database not avaialble'});
    }
  }

  // Private method for finding the index in the in-memory list of the element we are working on
  findWithAttr(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }
    return -1;
  }

}  


module.exports = MemberList;



