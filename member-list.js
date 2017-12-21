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

class MemberList {
  /**
   * MemberList object constructor.  Connects to a mongoDB based on environment.
   *   Optionally, calls a callback to inform creator that db is ready
   *
   * @function MemberList constructor
   * @param {callback} - callback when list has been updated from db
   */
  constructor(cb) {
    // TODO figure out how to make this work for LARGE lists that can't all be in memory
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
   * Fetches all the members in the database and returns them as an array
   * Members are stored as array of JSON Objects.  Each member JSON contains
   * TODO
   *
   * @function getMembers
   * @param {callback} - callback when list has been updated from db
   * @returns {array} -- an array of member objects populated from the db
   */
  getMemberList(cb) {
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
   * Returns details for a particular member based on phone number
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
        return cb(null, {status: 200, 
          message: 'Added member succesfully.'});
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
        return cb(null, {status: 200, 
          message: 'Member Updated succesfully.'});
      });
    } else {
      return cb(null, {status: 200, message: 'Database not avaialble'});
    }
  }

  /**
   * Increments the sent and (optionally failed) counters
   *
   * @function incrementMemberMessageCounts
   * @param {int} number - toNumber we index on
   * @param {boolean} setFailed -- if true we increment the failed count
   * @param {callback} - optional callback when counts are incremente
   * @returns {object} -- an object with an appropriate http response code and message
   * 
   */
  incrementMemberMessageCounts(number, setFailed, cb) {
    if (mConfig.collection) {
      let failedIncrement = (setFailed) ? 1 : 0;
      mConfig.collection.update({_id: number}, {$inc: {confirmedSent: 1, confirmedFailed: failedIncrement}}, function (err, res) {
        if (err){
          if (cb) return cb(err);
          else return console.error(err.message);
        }
        if ((!res) || (!res.result) || (res.result.nModified != 1)) {
          let msg = 'Did not increment counts for message sent to '+ number;
          if (cb) return cb(new Error(msg));
          else return console.error(msg);
        }
        if (cb) cb(null, res);
      });
    } else {
      let msg = 'Increment Counts failed becasue DB is not available';
      if (cb) cb(new Error(msg));
      else console.error(msg);
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
          return cb(null, {status: 500, message: err.message});          
        }
        if (res.deletedCount === 0) {
          return cb(null, {status: 400, message: 'Item does not exist in DB.'});            
        } 
        return cb(null, {status: 200, message: 'Member deleted succesfully.'});
      });
    } else {
      return cb(null, {status: 200, message: 'Database not avaialble'});
    }
  }
}

module.exports = MemberList;



