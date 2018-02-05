/*
 * tropo-connector.js
 * 
 * This module handles the interaction with Tropo for the sms Notifier backend
 * The idea is to encapsulate interactions with Tropo so it could be replaced
 * with another cPaaS if necessary
 * 
 * JP Shipherd 11/22/2017
 */

var debug = require('debug')('TropoConnector');

 // Request Setup to send request to Tropo
var request = require('request');
// Request Debug library dumps all kinds of info to the console
//require('request-debug')(request);

// This is a helper library for calling Tropo if we ever get the NPM version right
var tropo_webapi = require('tropo-webapi'); 


class TropoConnector {
  constructor(memberList) {
    if ((!process.env.TROPO_PUBLIC_NUMBER) || (!process.env.TROPO_ADMIN_NUMBER) ||
    (!process.env.TROPO_API_KEY)) {
      console.error('Cannot read Tropo details from environment');
    } else {
      this.tropoPublicNumber = process.env.TROPO_PUBLIC_NUMBER;
      this.tropoAdminNumber = process.env.TROPO_ADMIN_NUMBER;
      this.tropoApiKey = process.env.TROPO_API_KEY;
    }
    this.tropoUri = '/1.0/sessions?action=create&token='+this.tropoApiKey;
    this.memberList = memberList;
  }

 
/**
   * This method is called by our server when the user hits Send on the webform
   *
   * @function processSendRequest
   * @param {object} req - Body of original HTTP request from the client
   * @param {object} res - Response object that this method should use
   */
  processSendRequest(req, res) {
    if ((!req.body) || (!req.body.message) || (!req.body.numbers)) {
      res.send(422, 'Missing required form data');
      return;
    }
    var tropoUri = this.tropoUri+'&network=SMS';
    tropoUri += '&numberToDial=' + encodeURIComponent(req.body.numbers);
    tropoUri += '&msg='+ encodeURIComponent(req.body.message);
    if (req.body.isAdmin) {
      tropoUri += '&isAdmin='+ encodeURIComponent(req.body.isAdmin);      
      tropoUri += '&adminState='+ encodeURIComponent(req.body.adminState);
    }

    // Post the URI to a Tropo app to trigger the SMS
    console.log('Final URI %s\n', tropoUri);
    var options = {
      uri: 'https://api.tropo.com' + tropoUri,
      method: 'GET',
      headers: {'Accept': 'application/json'}
    };

    request.get(options, this.tropoCallbackWithHttpResponse(res));
    console.log('Sent request to Tropo and will show user request in browser.');      
  }

  /**
   * This is handler for the response from Tropo after we made an outbound request
   * We take the Tropo Response and forward it back to the orignating requestor to the 
   * /sendMessages API
   *
   * @function tropoCallbackWithHttpResponse
   * @param {object} res - Response object from Tropo
  */
  tropoCallbackWithHttpResponse(res) {
    return function(error, tropoResponse) {
      if(error) {
        console.error('Got an error back from tropo: '+error.message);
        return res.status(500).send(error.message);
      }
      res.status(tropoResponse.statusCode).send(tropoResponse.statusMessage);
    };
  }

  /**
     * This method is called by our server when Tropo calls the initial URI for our smsNotifier app
     *
     * @function processInitialCallback
     * @param {object} req - Body of original HTTP request from Tropo
     * @param {object} res - Response object that this method should use
     */
  // We build the Tropo WebAPI response instructing Tropo to call or message the number submitted
// in the webform with the message that was submitted in the webform

  processInitialCallback(req, res) {
    // Check if Tropo called us in response to an inbound event or a request
    try {
      var reqJson=req.body;
      var userType = reqJson.session.userType;
      var numberToDial, network, msg;
      var tropo = new tropo_webapi.TropoWebAPI();
      // Handle inbound messages or calls
      if (('undefined' != userType) && (userType === 'HUMAN')) {
        return this.processIncoming(res, reqJson, tropo);
      }

      // Set Default Values to use if not passed in as URL params
      // TODO use environment variables for Admin stuff
      var out_num = '+17813086976';  // JP's mobile phone
      var out_msg = 'JP, this is a message from the ABR Notifier.  If you are getting this something is amiss!';
      var out_network = 'SMS';
      if ('undefined' != reqJson.parameters) {
        numberToDial = reqJson.session.parameters.numberToDial;
        network = reqJson.session.parameters.network;
        msg = reqJson.session.parameters.msg;
      }
      // Handle webform values if they are set
      if (typeof numberToDial !== 'undefined') {
        console.log('Got number to dial from the webform: ' + numberToDial);
        out_num = numberToDial;
      }
      if (typeof network !== 'undefined') {
        console.log('Got network from the webform: ' + network);
        out_network = network.toUpperCase();
        if ((out_network != 'SMS') && (out_network != 'PSTN')  && (out_network != 'SIP')) {
          out_network = 'PSTN';
        }
      }
      if (typeof msg !== 'undefined') {
        console.log('Got msg from the webform: ' + msg);
        out_msg = msg;
      }  

      // Add Detail about who this is from and opt out chocies
      // TODO use an envrionment var for the sender
      if (reqJson.session.parameters.isAdmin) {
        var fromNum = this.tropoAdminNumber;
      } else {
        out_msg = out_msg.replace(/\n\n/g, '{newline}');
        out_msg = 'Message from Albany Bike Rescue:{newline}' + out_msg + '{newline}Reply STOP to opt out.';
        fromNum = this.tropoPublicNumber;
      }
      // Build JSON to ask Tropo to perform request
      var out_num_array = out_num.split(',');
      for (let i=0; i<out_num_array.length; i++) {
        let numOut = out_num_array[i];
        if (numOut.length >= 9) { //work around issue where we sometimes get blank number
          //TropoWebAPI.message = (say, to, answerOnMedia, channel, from, name, network, required, timeout, voice)
          console.log('Kicking off reqeust message:' + out_msg + '. via:' + network + ' to: ' + out_num);
          tropo.message(out_msg, numOut, null, 'TEXT', fromNum, null, network, null, 120, null);
        } else {
          console.error('Got a request to send a text to an invalid number:'+numOut);
        }
      }
      // This wierd hack is the onlly way I could figure out how to get '\n' char into the message sent to Tropo
      var newJSON = tropo_webapi.TropoJSON(tropo);
      newJSON = newJSON.replace(/{newline}/g, '\\n');
      console.log(newJSON);
      return res.end(newJSON);
    } catch (e) {
      return this.tropoError(res, 'Unable to find userType in Tropo JSON payload. Cannot process request.');
    }   
  }

  /**
   * This method generates a response to an incoming message or call
   *
   * @function processingIncoming
   * @param {object} res - Response object that this method should use
   * @param {object} reqJson - Payload of message from Tropo
   * @param {object} tropo -- Tropo webAPI object to build response
   * 
   * This method will return a response to Tropo instructing it on how to respond
   */
  processIncoming(res, reqJson, tropo) {
    console.log('Responding to a response');
    var fromNum = reqJson.session.from.e164Id;
    var toNum = reqJson.session.to.e164Id;
    var incomingMsg = reqJson.session.initialText;

    // Handle an unexpected phone call
    if (reqJson.session.from.channel === 'VOICE') {
      //tropo.call(out_num, null, null, null, null, null, network, null, null, 120);
      tropo.say('Hi.  I\'m the Albany Bike Rescue text message phone number, but I don\'t do anything interesting if you call me.');      
      return res.end(tropo_webapi.TropoJSON(tropo));
    }

    let that = this;
    let msg = '';
    // Check if this is a response to the user number
    if (toNum === this.tropoPublicNumber) {
      // Check if this is a STOP or RESTART request
      if ((incomingMsg.toUpperCase() === 'STOP') || (incomingMsg.toUpperCase() === 'RESTART')) {
        // If so correlate the number and update the optOut field in the database
        let optOut = true;
        if (incomingMsg.toUpperCase() === 'RESTART') {optOut = false;} 
        that.memberList.setOptOut(fromNum, optOut, function(err, status) {
          if ((err)|| (!status)) {return that.tropoError(res, 'Cannot figure out who sent this! Ignoring');}          
          // Respond that the optout will be enforced, or is taken off
          msg = 'You will no longer get text notifications from Albany Bike Rescue.  Reply RESTART to get them again.';
          if (!optOut) {msg = 'You will start getting notifications from Albany Bike Resuce again.';}
          tropo.message(msg, fromNum, null, 'TEXT', that.tropoPublicNumber, null, 'SMS', null, 120, null);
          return res.end(tropo_webapi.TropoJSON(tropo));
        });
      } else {
        // Else send it to the admins
        // Get the details on who this was from
        that.memberList.getMember(fromNum, function(err, member){
          if ((err)|| ((!member) && (fromNum != that.tropoAdminNumber))) {
            // We ignore the message if it didn't come from this system or one of its memembers
            return that.tropoError(res, 'Cannot figure out who sent this!  Ignoring');
          } 
          if (member) {
            // Tell the admins who this came from...         
            msg = member.firstName+' '+member.lastName+' ('+member.number+') responded:{newline}'+incomingMsg;
          } else {
            // Unless this is us responding to an admin request
            msg = incomingMsg;
          }
          // Fetch the admins from the member list and send to each of them.
          that.memberList.getAdminList(function (err, adminList){
            if ((err)|| (!adminList.length)) {return that.tropoError(res, 'No Admins to send this to.');}
            for (let i=0; i<adminList.length; i++) {
              let admin = adminList[i];
              console.log('Sending message:'+msg + ' to: ' + admin.firstName);
              //Call(to, answerOnMedia, channel, from, headers, name, network, recording, required, timeout, allowSignals, machineDetection, voice, callbackUrl, promptLogSecurity, label)
              //TropoWebAPI.message = (say, to, answerOnMedia, channel, from, name, network, required, timeout, voice)
              tropo.message(msg, admin.number, null, 'TEXT', that.tropoAdminNumber, null, 'SMS', null, 120, null);
            }
            return that.packageAndSendMessages(res, tropo);
          });
        });
      }
    } else if (toNum === that.tropoAdminNumber) {
      // This is a message to the admin number so it came from an Admin
      // Possible TODO -- validate the the from number matches one that matches admins
      msg = incomingMsg.replace(/\n\n/g, '{newline}');
      // Generally messages sent to the Admin number are broadcast to all members
      // We check here to see if the special "Reply <number>"" command is used in which case
      // the message is sent only to the requested number.  This is useful since other admins
      // can see if a question is answered, but it still ensures that members only ever see the
      // public number
      if (msg.toUpperCase().startsWith('REPLY')) {
        // Future feature:  don't FORCE the second word of the REPLY command to be a number
        // Send it to the last number (this might be tricky if the server goes to sleep)
        let words = msg.split(' ');
        words.shift();  //get rid of the word "reply"
        let number = words.shift(); // get the number to send it to?
        let e164_number = that.idFromNumber(number);
        if (!e164_number) {
          // Number in reply command was invalid.  Let admin know
          msg = 'Cannot send a text to invalid number: ' + number+ '. Try again using REPLY <NUMBER> <MESSAGE>, ie:{newline}' +
                'Reply 518-555-1234 Hi There!{newline}{newline}No spaces allowed in number.';
          tropo.message(msg, that.tropoPublicNumber, null, 'TEXT', that.tropoAdminNumber, null, 'SMS', null, 120, null);
        } else {
          msg = words.join(' ');
          tropo.message(msg, e164_number, null, 'TEXT', that.tropoPublicNumber, null, 'SMS', null, 120, null);
          msg = 'Message sent to: ' + number+ '.';
          tropo.message(msg, that.tropoPublicNumber, null, 'TEXT', that.tropoAdminNumber, null, 'SMS', null, 120, null);          
        }
        return that.packageAndSendMessages(res, tropo);
      } else {
        // Treat this is as a BROADCAST request from an admin, send it to all members
        that.memberList.getMemberList(function(err, memberList) {
          if ((err)|| (!memberList.length)) {return that.tropoError(res, 'Could not get the member list.');}
          msg = 'Message from Albany Bike Rescue:{newline}' + msg + '{newline}Reply STOP to opt out.';
          for (let i=0; i<memberList.length; i++) {
            let member = memberList[i];
            //TropoWebAPI.message = (say, to, answerOnMedia, channel, from, name, network, required, timeout, voice)
            if (!member.optOut) {
              console.log('Broadcasting message:'+msg + ' to: ' + member.firstName);
              tropo.message(msg, member.number, null, 'TEXT', that.tropoPublicNumber, null, 'SMS', null, 120, null);
            }
          }
          return that.packageAndSendMessages(res, tropo);
        });
      }
    } else {
      // Else we didn't expect a text to this number, ignore
      return that.tropoError(res, 'Ignoring inbound to unexpected number: '+toNum);
    }
  }

  /**
   * This method is called by our server when Tropo sends and SMS Delivery receipt
   *
   * @function processSmsDlr
   * @param {object} req - Body of original HTTP request from Tropo
   * @param {object} res - Response object that this method should use
   */
  processSmsDlr(req, res) {
    var reqJson=req.body;
    try {
      let toNumber = reqJson.data.to;
      if (toNumber[0] == '+') toNumber = toNumber.substr(1);
      let status = reqJson.data.stat;
      console.log('Delivery Receipt for message to: ' +toNumber+' has status: '+status);
      if ((status === 'Accepted') || (status === 'Delivered') || (status === 'Sent')) {
        this.memberList.incrementMemberMessageCounts(toNumber, /*setFailed=*/false);
      } else {
        this.memberList.incrementMemberMessageCounts(toNumber, /*setFailed=*/true);        
      }
    } catch(e) {
      console.error('Error processing SMS Delivery Receipt: '+e.message);   
    } 
    res.send('OK');
  }

  /**
   * This is a convenience method for putting newlines in a (set of) Tropo SMS messages
   * and sending the payload back to Tropo
   *
   * @function packageAndSendMessages
   * @param {object} res - Response object that this method should use
   * @param {string} tropo- Tropo WebAPI object
   */
  packageAndSendMessages(res, tropo) {
    // This wierd hack is the onlly way I could figure out how to get '\n' char into the message sent to Tropo
    var newJSON = tropo_webapi.TropoJSON(tropo);
    newJSON = newJSON.replace(/{newline}/g, '\\n');
    console.log(newJSON);
    return res.end(newJSON);        
  }

  /**
   * This is a convenience method for responding to a Tropo request when an error occurs.
   * Info about the error is logged and we send a response telling Tropo to end the session.
   *
   * @function tropoError
   * @param {object} res - Response object that this method should use
   * @param {string} msg- Error message to log
   */
  tropoError(res, msg) {
    console.error(msg);
    var tropo = new tropo_webapi.TropoWebAPI();
    tropo.hangup();
    return res.end(tropo_webapi.TropoJSON(tropo));
  }

  // Helper function for getting a E.164 ID from a user entered number
  idFromNumber(number) {
    var bare_num = number.replace(/\D/g, '');
    if (bare_num.length === 10) {
      return ('1'+bare_num);
    } else if (!((bare_num.length === 11) && (bare_num[0] === '1'))) {
      console.error('Can\'t calculate key from '+number);
    }
    return bare_num;
  }  
}
  
 
module.exports = TropoConnector;
