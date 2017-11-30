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
  processSendRequest(req, res, myWebhookData) {
    if ((!req.body) || (!req.body.message) || (!req.body.numbers)) {
      res.send(422, 'Missing required form data');
      return;
    }
    var tropoUri = this.tropoUri+'&network=SMS';
    tropoUri += '&numberToDial=' + encodeURIComponent(req.body.numbers);
    tropoUri += '&msg='+ encodeURIComponent(req.body.message);
    
    //res.writeHead(200, {'content-type': 'text/plain'});

    // Post the URI to a Tropo app to trigger the SMS
    console.log('Final URI %s\n', tropoUri);
    var options = {
      uri: 'https://api.tropo.com' + tropoUri,
      method: 'GET',
      headers: {'Accept': 'application/json'}
    };

    // Clear an existing (or create a new) Tropo Webhook Data object for this session
    // Once we have it we'll callback into Tropo
    myWebhookData.getWebhookDataForNewTropoSession(req.sessionID)
    //myWebhookData.getWebhookDataForNewTropoSession(1)
    .then(function (webhookData) {
      request.get(options, tropoCallbackWithHttpResponse(res, webhookData));
      console.log('Sent request to Tropo and will show user request in browser.');      
    })
    .catch(function (err) {
      console.log('Failed to find/create webhook data object for this Tropo request: '+err.message);
      res.writeHead(200, {'content-type': 'text/html'});
      res.write('<html><body>Unable to create Webhook Data object for Tropo request:<br>');
      res.write(err.message);
      res.end('<br/><a href=\'/\'>Return to form to Try again</a></body></html>');
    });
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
      out_msg = out_msg.replace(/\n\n/g, '{newline}');
      out_msg = 'Message from Albany Bike Rescue:{newline}' + out_msg + '{newline}Reply STOP to opt out.';
      // Build JSON to ask Tropo to perform request
      var out_num_array = out_num.split(',');
      out_num = out_num_array.pop();
      while (out_num) {
        //to, answerOnMedia, channel, from, headers, name, network, recording, required, timeout
        //tropo.call(out_num, null, null, null, null, null, out_network, null, null, 120);
        //tropo.say(out_msg);
        //TropoWebAPI.message = (say, to, answerOnMedia, channel, from, name, network, required, timeout, voice)
        console.log('Kicking off reqeust message:' + out_msg + '. via:' + network + ' to: ' + out_num);
        tropo.message(out_msg, out_num, null, 'TEXT', this.tropoPublicNumber, null, network, null, 120, null);
        //tropo.hangup();
        out_num = out_num_array.pop();
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
          let msg = 'You will no longer get text notifications from Albany Bike Rescue.  Reply RESTART to get them again.';
          if (!optOut) {msg = 'You will start getting notifications from Albany Bike Resuce again.';}
          tropo.message(msg, fromNum, null, 'TEXT', that.tropoPublicNumber, null, 'SMS', null, 120, null);
          return res.end(tropo_webapi.TropoJSON(tropo));
        });
      } else {
        // Else send it to the admins
        // Get the details on who this was from
        that.memberList.getMember(fromNum, function(err, member){
          if ((err)|| (!member)) {return that.tropoError(res, 'Cannot figure out who sent this!  Ignoring');}          
          let msg = member.firstName+' '+member.lastName+' ('+member.number+') responded:{newline}'+incomingMsg;
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
            // This wierd hack is the onlly way I could figure out how to get '\n' char into the message sent to Tropo
            var newJSON = tropo_webapi.TropoJSON(tropo);
            newJSON = newJSON.replace(/{newline}/g, '\\n');
            console.log(newJSON);
            return res.end(newJSON);        
          });
        });
      }
    } else {
      // Check if this is a message to the admin number
      // Check if this is a BROADCAST request from an admin
      // Send it to the list

      // Check if this is a REPLY request from an admin
      // Send it to the last number (this might be tricky if the server goes to sleep)
      // Else respond that we don't know what to do with it (remind about the broadcast command)

      // Else we didn't expect a text to this number, ignore

      //tropo.call(out_num, null, null, null, null, null, network, null, null, 120);
      tropo.say('I got your reply, but I don\'t do anything interesting with it.  Like Greta Garbo kind of said: \'I want to be ignored...\'');            
      // This wierd hack is the onlly way I could figure out how to get '\n' char into the message sent to Tropo
      var newJSON = tropo_webapi.TropoJSON(tropo);
      newJSON = newJSON.replace(/{newline}/g, '\\n');
      console.log(newJSON);
      return res.end(newJSON);        
    }
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
}

/*
   * This is handler for the response from Tropo after we made an outbound request
   * We take the Tropo Response and forward it back to the orignating requestor to the 
   * /sendMessages API
   *
   * @function tropoCallbackWithHttpResponse
   * @param {object} res - Response object from Tropo
   * @param {object} webhookData - TODO document what this does
*/
function tropoCallbackWithHttpResponse(res, webhookData) {
  return tropoCallback = function(error, resp, body) {
    var tropoError = '';
    if(error) {
      tropoError = error;
    }
    //Check for any unexpected status codes
    if(resp.statusCode !== 200){
      tropoError='Invalid Status Code Returned:' + resp.statusCode + ' : ' + resp.text;
    }
    if (tropoError){
      res.writeHead(200, {'content-type': 'text/html'});
      res.write('<html><body>');
      res.write(tropoError);
      res.end('<br/><a href=\'/\'>Return to form to Try again</a></body></html>'); 
      return;     
    }
    var response = JSON.parse(body);

    // Set the Tropo session ID in the webhook Data object
    // TODO Handle an undefined id
    webhookData.tropoSessionId = response.id;
    // TODO set a timer to expire the webhook data element in the array after an hour

    // Send the response back to the HTTP client
    /*
		console.log('Displaying the Tropo response...');
		res.writeHead(200, {'content-type': 'text/html'});
		res.write('<html><body>Tropo Replied:<br>');
		res.write('<textarea rows=\'10\' cols=\'80\' style=\'border:none;\'>');
		res.write(body);
		res.write('</textarea>');
    if (('undefined' != typeof(response.success)) && (true === response.success)) {
      res.write('<br/><a href=\'/showEvents\?sessionId='+response.id+''>Display CDR and/or SMS Delivery Reports</a></body></html>');
    }
    res.end('<br/><a href=\'/\'>Return to form to Try again</a></body></html>');
    */
    res.send(200);
  };
}

  
 
module.exports = TropoConnector;
