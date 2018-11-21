/*
 * twilio-connector.js
 * 
 * This module handles the interaction with Twilio for the sms Notifier backend
 * The idea is to encapsulate interactions with Twilio so it could be replaced
 * with another cPaaS if necessary
 * 
 * JP Shipherd 11/19/2018
 */
/*eslint-env node*/  // Don't complain about console.log statements

var debug = require('debug')('TwilioConnector');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

class TwilioConnector {
  constructor(memberList) {
    if ((!process.env.TWILIO_PUBLIC_NUMBER) || (!process.env.TWILIO_ACCOUNT_SID) ||
    (!process.env.TWILIO_AUTH_TOKEN)) {
      console.error('Cannot read Tropo details from environment');
    } else {
      this.twilioPublicNumber = process.env.TWILIO_PUBLIC_NUMBER;
      this.twilioAdminNumber = process.env.TWILIO_ADMIN_NUMBER;
      this.authToken = process.env.TWILIO_AUTH_TOKEN;
      this.accountSid = process.env.TWILIO_ACCOUNT_SID
      this.organizationName = process.env.REACT_APP_ORGANIZATION_NAME;
      this.twilioClient = require('twilio')(this.accountSid, this.authToken)
    }
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
    var numbersList = req.body.numbers;
    var message = 'Message from '+ this.organizationName+':\n' + req.body.message + '\nReply STOP to opt out.';
    console.log('Attempting to send message: '+message)
    var numArray = numbersList.split(',');
    return this.sendAllMessagesAndRespond(res, message, numArray);
  }

 /**
   * This method is called by our server when the cPaaS sends us a Webhook
   * for an incoming message or call
   *
   * @function processInitialCallback
   * @param {object} req - Body of original HTTP request from Twilio
   * @param {object} res - Response object that this method should use
   */
  processInitialCallback(req, res) {
    var reqJson=req.body;
    // If this is an incoming call, just play a message and hangup
    if (reqJson.Called != undefined) {
      // Handle an unexpected phone call
      console.log('Processing an Incoming Call from: '+reqJson.From);
      const twiml = new VoiceResponse();
      twiml.say({voice: 'man', language: "en"},
                'Hi.  I\'m the '+ this.organizationName+' text message phone number, '+
                'but I don\'t do anything interesting if you call me. '+
                'Try sending me a text message instead.');
      res.type('text/xml');
      return res.end(twiml.toString());
    }
    // Otherwise process an incoming SMS
    return this.processIncomingSMS(res, reqJson);
  }

  /**
   * This method generates a response to an incoming message
   *
   * @function processingIncoming
   * @param {object} res - Response object that this method should use
   * @param {object} reqJson - Payload of message from Tropo
   * 
   * This method will return a response to Tropo instructing it on how to respond
   */
  processIncomingSMS(res, reqJson) {
    // Lets find out who called us
    var fromNum = reqJson.From;
    var toNum = reqJson.To;
    var incomingMsg = reqJson.Body;
    
    console.log('Processing an Incoming Text Message from: '+fromNum);

    // Check if this is a response to the user number
    if (toNum === this.twilioPublicNumber) {
      return this.processTextToPublicNumber(res, fromNum, incomingMsg);
    } else if (toNum === this.twilioAdminNumber) {
      return this.processTextToAdminNumber(res, fromNum, incomingMsg);
    } else {
      // Else we didn't expect a text to this number, ignore
      return this.respondError(res, 'Ignoring inbound to unexpected number: '+toNum);
    }
  }

 /**
   * Process an incoming text to the public number
   *
   * @function processTextToPublicNumber
   * @param {object} res - Response object that this method should use
   * @param {string} fromNum - Number the incoming text was sent from
   * @param {string} incomingMsg - Message that was sent to us
   */
  processTextToPublicNumber(res, fromNum, incomingMsg) {
    let that = this;
    let msg = '';
      // Check if this is a STOP or RESTART request
    if ((incomingMsg.toUpperCase() === 'STOP') || (incomingMsg.toUpperCase() === 'RESTART')) {
      // If so correlate the number and update the optOut field in the database
      let optOut = true;
      if (incomingMsg.toUpperCase() === 'RESTART') {optOut = false;} 
      that.memberList.setOptOut(this.idFromNumber(fromNum), optOut, function(err, status) {
        if ((err)|| (!status)) {return that.respondError(res, 'Cannot figure out who sent this! Ignoring');}          
        // Respond that the optout will be enforced, or is taken off
        msg = 'You will no longer get text notifications from '+ that.organizationName+'.  Reply RESTART to get them again.';
        if (!optOut) {msg = 'You will start getting notifications from '+ that.organizationName+' again.';}
        return that.sendMessageAndRespond(res, msg, fromNum)
      });
    } else {
      // Else send it to the admins
      // Get the details on who this was from
      that.memberList.getMember(this.idFromNumber(fromNum), function(err, member){
        if ((err)|| ((!member) && (fromNum != that.twilioAdminNumber))) {
          // We ignore the message if it didn't come from this system or one of its memembers
          return that.respondError(res, 'Cannot figure out who sent this!  Ignoring');
        } 
        if (member) {
          // Tell the admins who this came from...         
          msg = member.firstName+' '+member.lastName+' ('+member.number+') texted ABR:\n'+incomingMsg;
        } else {
          // Unless this is us responding to an admin request
          msg = incomingMsg;
        }
        // Fetch the admins from the member list and send to each of them.
        that.memberList.getAdminList(function (err, adminList) {
          if ((err)|| (!adminList.length)) {return that.respondError(res, 'No Admins to send this to.');}
          return that.notifyMemberList(res, adminList, msg, that.twilioAdminNumber);
        });
      });
    }
  }

 /**
   * Process an incoming text to the admin number
   *
   * @function processTextToAdminNumber
   * @param {object} res - Response object that this method should use
   * @param {string} fromNum - Number the incoming text was sent from
   * @param {string} msg - Message that was sent to us
   */
  processTextToAdminNumber(res, fromNum, msg) {
    let that = this;
    // Messages to the admin number should only come from an Admin, lets verify that
    // Fetch the admins from the member list and send to each of them.
    let adminFound = false;
    fromNum = this.idFromNumber(fromNum);
    that.memberList.getAdminList(function (err, adminList){
      if ((!err) && (adminList.length)) {
        for (let i=0; i<adminList.length; i++) {
          let admin = adminList[i];
          if (admin._id == fromNum) {
            console.log('Processing a message to the Admin Number from: '+admin.firstName);
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
                msg = 'Cannot send a text to invalid number: ' + number+ '. Try again using REPLY <NUMBER> <MESSAGE>, ie:\n' +
                      'Reply 518-555-1234 Hi There!\n\nNo spaces allowed in number.';
                return that.sendMessageAndRespond(res, msg, fromNum, that.twilioAdminNumber)
              } else {
                msg = words.join(' ');
                that.sendMessageAndRespond(res, msg, e164_number, that.twilioPublicNumber)
                msg = admin.firstName + ' responded to ' + number+ ' with:\n'+msg;
                return that.notifyMemberList(res, adminList, msg, that.twilioAdminNumber);
              }
            } else {
              // Treat this is as a BROADCAST request from an admin, send it to all members
              adminFound = true;
              break;
            }
          }
        }
      }
      if (adminFound) {
        // Broadcast the message to all members
        that.memberList.getMemberList(function(err, memberList) {
          if ((err)|| (!memberList.length)) {return that.respondError(res, 'Could not get the member list.');}
          msg = 'Message from '+ that.organizationName+':\n' + msg + '\nReply STOP to opt out.';
          return that.notifyMemberList(res, adminList, msg, that.twilioPublicNumber);
        });
      } else {
        // We get here only if we could not match the fromNumber to an admin account
        console.error('Got a message to the Admin number from '+fromNum+'. This number does not belong to an Admin');
        msg = 'Cannot accept messages from this number.  Contact the staff at '+ that.organizationName+' if you think this is an error.\n'+
              'Do feel free to text us on '+that.twilioPublicNumber;
        return that.sendMessageAndRespond(res, msg, fromNum, that.twilioAdminNumber)
      }
    });
  }

  /**
   * This method is called by our server when Twilio sends an SMS Delivery webhook
   *
   * @function processSmsDlr
   * @param {object} req - Body of original HTTP request from Twilio
   * @param {object} res - Response object that this method should use
   */
  processSmsDlr(req, res) {
    var reqJson=req.body;
    try {
      let toNumber = this.idFromNumber(reqJson.To);
      let status = reqJson.SmsStatus;
      console.log('Delivery Receipt for message to: ' +toNumber+' has status: '+status);
      if (status === 'delivered') {
        this.memberList.incrementMemberMessageCounts(toNumber, /*sentFailed=*/false);
      } else if ((status === 'undelivered') || (status === 'failed')) {
        this.memberList.incrementMemberMessageCounts(toNumber, /*sentFailed=*/true);        
      } else {
        console.log('Ignoring interim status for the purposes of message counts')
      }
    } catch(e) {
      console.error('Error processing SMS Delivery Receipt: '+e.message);   
    } 
    res.send('OK');
  }


  /**
   * This is a convenience method for sending SMS messages
   * and populating a "results" object when we hear back from Twilio
   *
   * @function sendMessage
   * @param {object} twilioConfig - our "this" TwilioConfig instance
   * @param {object} results - object to keep track of succeses and failurs
   * @param {string} message - body of message to send
   * @param {string} fromNumber - number we are sending this message from
   * @param {string} number - number we are sending this message to
   */
  sendMessage(twilioConfig, results, message, fromNumber, number) {
    return new Promise(function (resolve, reject) {
      twilioConfig.twilioClient.api.messages.create({
        body: message,
        to: number,
        from: fromNumber,
        statusCallback: 'https://abrnotifier.ngrok.io/smsDeliveryReceiptHandler'
      }).then(function(data) {
        console.log('Sent to '+number+', data: '+data)
        results.sent.push(number);
        resolve(results)
      }).catch(function(err){
        console.error(err.message);
        twilioConfig.memberList.incrementMemberMessageCounts(twilioConfig.idFromNumber(number), /*sentFailed=*/true);        
        results.failed.push(number);
        resolve(results);
      });
    });
  }

  /**
   * This is a convenience method for sending an SMS messages and responding
   * to the originating HTTP request when we hear back from Twilio
   *
   * @function sendMessageAndRespond
   * @param {object} res - the HTTP response object to act on
   * @param {string} message - body of message to send
   * @param {string} number - number we are sending this message to
   * @param {string} fromNumber - number we are sending this message from
   */
  sendMessageAndRespond(res, message, number, fromNumber) {
    if (!fromNumber) {
      fromNumber = this.twilioPublicNumber;
    }
    this.twilioClient.api.messages.create({
      body: message,
      to: number,
      from: fromNumber,
      statusCallback: 'https://abrnotifier.ngrok.io/smsDeliveryReceiptHandler'
    }).then(function(data) {
      console.log('Sent to '+number+', data: '+data)
      res.status(200).send("Messages sent");
    }).catch(function(err){
      console.error(err.message);
      twilioConfig.memberList.incrementMemberMessageCounts(twilioConfig.idFromNumber(number), /*sentFailed=*/true);        
      res.status(err.code).send(err.message)
    });
  }

  /**
   * This is a convenience method for sending multiple SMS messages
   *
   * @function sendAllMessages
   * @param {string} message - body of message to send
   * @param {array} numArray - array of numbers to send message to
   * @param {string} fromNumber - number we are sending this message from
   */
  sendAllMessages(message, numArray, fromNumber) {
    var results = {
      sent: [],
      failed: []
    };
    if (!fromNumber) {
      fromNumber = this.twilioPublicNumber;
    }
    return Promise.all(numArray.map(this.sendMessage.bind(null, this, results, message, fromNumber)));
  }

  /**
   * This is a convenience method for sending an SMS messages and responding
   * to the originating HTTP request when we hear back from Twilio
   *
   * @function sendAllMessageAndRespond
   * @param {object} res - the HTTP response object to act on
   * @param {string} message - body of message to send
   * @param {string} numArray - array of numbers to send the message to
   * @param {string} fromNumber - number we are sending this message from
   */
  sendAllMessagesAndRespond(res, message, numArray, fromNumber) {
    this.sendAllMessages(message, numArray, fromNumber).then(
      function(results) {
        var result = results[results.length-1]
        if ((!result) || (!result.failed) || (!result.sent)) {
          res.status(500).send("Can't tell if messages were sent or not");
        } else if (result.failed.length) {
          var resMsg = 'Failed to send messages to all numbers.'
          if (result.sent.length) {
            resMsg = 'Failed to send to some numbers: '+result.failed.join(','); 
          }
          res.status(400).send(resMsg);
        } else {
          console.log('All the message went!');
          res.status(200).send("All messages sent");
        }
      },
      function(err) {
        console.log('Error is' +err);
        res.status(500).send("Something went wrong.");
      }
    );
  }

  /**
   * Convenience method for notifying the a list of members
   *
   * @function notifyMemberList
   * @param {object} res - Response object that this method should use
   * @param {array} adminList - List of members who are administrators
   * @param {string} msg - Message to send
   * @param {string} fromNumber - Number that the message is from
   */
  notifyMemberList(res, memberList, msg, fromNumber) {
    var listMemberNumbers = []
    for (let i=0; i<memberList.length; i++) {
      let member = memberList[i];
      if (!member.optOut) {
        console.log('Sending message:'+msg + ' to: ' + member.firstName);
        listMemberNumbers.push(member._id);
      }
    }
    return this.sendAllMessagesAndRespond(res, msg, listMemberNumbers, fromNumber)
  }
  
  /**
   * This is a convenience method for responding to a cPaaS request when an error occurs.
   * Info about the error is logged and we send a response telling Tropo to end the session.
   *
   * @function respondError
   * @param {object} res - Response object that this method should use
   * @param {string} msg- Error message to log
   */
  respondError(res, msg, status) {
    console.error(msg);
    if (!status) {status = 500;}
    res.status(status).send(msg);
  }

  // Helper function for getting a E.164 ID (without the plus sign) from a 
  // number we got from a user or in a Twilio webhook payload
  idFromNumber(number) {
    var bare_num = number.replace(/\D/g, '');
    if (bare_num.length === 10) {
      return ('1'+bare_num);
    } else if (!((bare_num.length === 11) && (bare_num[0] === '1'))) {
      console.error('Can\'t calculate key from '+number);
      return '';
    }
    return bare_num;
  }  
}
  
 
module.exports = TwilioConnector;
