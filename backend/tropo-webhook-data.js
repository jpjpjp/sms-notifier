// tropo-webhook-data.js
// An Object for storing the webhook data returned by Tropo
// An array of webhook data is stored, with one item maintained
// for each browser session
/*jshint esversion: 6 */
var debug = require('debug')('tropo-webhook-data');


// public AllWebhookData constructor
function AllWebhookData(){
  this.webhookDataArray = [];
}

// private tropoWebhookData constructor
function tropoWebhookData(browserSessionId){
  this.browserSessionId = browserSessionId;
  this.tropoSessionId = '';
  this.cdrCreatedData = {};
  this.cdrRatedData = {};
  this.smsDeliveryReceipt = {};
  this.lastViewTime = null;
  this.cdrCreatedTime = null;
  this.cdrRatedTime = null;
  this.smsDeliveryTime = null;
}

// This method will return a promise of a tropoWebhookData instance for a browser session
// It first checks if an instance already exists for this session.  If so it clears all the data
// assoicated with the previous Tropo session and returns that instance.
// If no instance exists (this is the first request for the browser session),  a new instance is 
// added to the array and this instance is returned
AllWebhookData.prototype.getWebhookDataForNewTropoSession = function getWebhookDataForNewTropoSession(browserSessionId) {
  var arr = this.webhookDataArray;
  return new Promise(function (resolve, reject) {
    try {
      var wData;
      for (var i = 0; i < arr.length; i++) {
        wData = arr[i];
        if (wData.browserSessionId === browserSessionId) {
          wData.tropoSessionId = '';
          wData.cdrCreatedData = {};
          wData.cdrRatedData = {};
          wData.smsDeliveryReceipt = {};
          wData.lastViewTime = null;
          wData.cdrCreatedTime = null;
          wData.cdrRatedTime= null;
          wData.smsDeliveryTime = null;
          return resolve(wData);
        } 
      }
      // If we got here this is the first time we've seen this browserSessionId
      wData = new tropoWebhookData(browserSessionId);
      arr.push(wData);
      // If this is the first element of our array set a timer to clean up after an hour of inactivity
      if (i === 0) {
          setTimeout(cleanupWebhookDataArray, 1000*60*60, arr);
      } 
      return resolve(wData);
    } catch(err) {
        return reject(err);
    }
  });
}

// This method will return a promise of a tropoWebhookData instance for a tropo session
// It first checks if an instance already exists for this session.  If not it rejects the promise
AllWebhookData.prototype.getWebhookDataForTropoSession = function getWebhookDataForTropoSession(tropoSessionId) {
  var arr = this.webhookDataArray;
  return new Promise(function (resolve, reject) {
    try {
      var wData;
      for (var i = 0; i < arr.length; i++) {
        wData = arr[i];
        if (wData.tropoSessionId === tropoSessionId) {
          return resolve(wData);
        } 
      }
      return reject(new Error('No Webhook Data associated with Tropo Session ID:' + tropoSessionId));
    } catch(err) {
      return reject(err);
    }
  });
}


// This private method gets called every hour and removes webhook data elements 
// that have had no activity in the last hour from the array
function cleanupWebhookDataArray(wDataArray){
  if (!wDataArray.length) {return;}
  var remove_indices = [];
  for (var i = 0; i < wDataArray.length; i++) {
    var wData = wDataArray[i];
    var lastTime = m.utc(wData.lastViewTime || wData.cdrRatedTime || wData.smsDeliveryTime || wData.cdrCreatedTime);
    if (('undefined' === typeof lastTime) || (!lastTime.isValid())) {continue;}
    if (lastTime.add(1, 'hour').isBefore(/*now*/)) {
      remove_indices.push(i);
      console.log('Will delete Webhook Data object for Tropo session '+wData.tropoSessionId+', last accessed '+lastTime.format('hh:mm:ss')+' UTC Time.')
    }
  }
  for (var i = 0; i < remove_indices.length; i++) {
    // remove the old elements from the array
    // our index gets lower each time so subtract i from the saved index
    wDataArray.splice(remove_indices[i]-i, 1);
  }
  if (wDataArray.length) {
    setTimeout(cleanupWebhookDataArray, 1000*60*60, wDataArray);
  }
}

module.exports = AllWebhookData;
