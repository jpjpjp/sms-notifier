/*
 * server.js
 * 
 * This is a node.js express application which provides a backend to send
 * sms notifications to the members of an organization.
 * 
 * Ran into wierd issues with mongo promises so have reverted to callbacks 11/25/17
 * 
 * APIs support
 *  
 * JP Shipherd 11/22/2017
 */
/* eslint-disable no-console */

// Express Setup
var express = require('express'),
  app     = express(),
  port    = parseInt(process.env.PORT, 10) || 1185;
var bodyParser = require('body-parser');
var debug = require('debug')('SMSNotifierServer');

// HTTP library to communicate with cPaaS
//var request = require('request');
// Request Debug library dumps all kinds of info to the console
//require('request-debug')(request);

// Create the connector to talk to the cPaaS (Communication Platform as a Service)
// We use Tropo
var TropoConnector = require('./tropo-connector.js');
var cPaasConnector = new TropoConnector();

// Create the MemberList to talk to the database and maintain member list
var MemberList = require('./member-list.js');
var memberList = new MemberList();

// This module manages an array of webhhook data object for each active session
var AllWebhookData = require('./tropo-webhook-data.js');
var myWebhookData = new AllWebhookData();
//var m = require('moment-timezone');

// Set Express Routes and fire up the server
// We need the cookie-parser and express-session in order to get
// a unique session ID per browser instance
//var cookieParser = require('cookie-parser');
var session = require('express-session');
//app.use(cookieParser());
app.use(session({
  secret: '34SDgsdgspxxxxsdfsaxxxdfsG', // just a long random string
  resave: false,
  saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Make server support CORS requests?
// TODO Understand if this is legit.  Probably can lock this down a bit.
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE');
  next();
});

// Express only serves static assets in production
if (process.env.NODE_ENV === 'production') {
  console.log('Running in production mode with static client assets.');
  app.use(express.static('../client/build'));
}

app.listen(port);
console.log('server listening on ' + port);

// Set Express Routes and fire up the server
// TODO This can probably be updated to a keep alive of sorts
// Nonetheless we need a was to set up sessions
app.get('/', function (req, res) {
  debug('Got a GET request to /');
  var sess = req.session;
  sess.papiLoginCompleted = false;
  res.sendFile( __dirname + '/' + 'tropo-login-form.html' );
});

// Provide the list of members to the client
// TODO modularize the member database functionality
app.get('/getMembers', function (req, res) {
  memberList.updateMemberListFromDb(function (err, list) {
    if (err) {
      console.error(err.message);
      res.status(500).send(err.message);
    }
    res.send(list);
  });
  /*
  res.send([
    {
      '_id': '518-641-1967',
      'number': '518-641-1967',
      'firstName': 'jp',
      'lastName': 'google voice',
      'optOut': false,
      'active': true,
      'confirmedSent': 0,
      'confirmedFailed': 0
    },
    {
      '_id': '4085553421',
      'number': '4085553421',
      'firstName': 'hipster',
      'lastName': 'dude',
      'optOut': true,
      'active': false,
      'confirmedSent': 0,
      'confirmedFailed': 0
    },
    {
      '_id': '8885551234',
      'number': '8885551234',
      'firstName': 'jane',
      'lastName': 'rider',
      'optOut': false,
      'active': true,
      'confirmedSent': 0,
      'confirmedFailed': 0
    },
    {
      '_id': '7813086976',
      'number': '7813086976',
      'firstName': 'JP',
      'lastName': 'Shipherd',
      'optOut': false,
      'active': true,
      'confirmedSent': 0,
      'confirmedFailed': 0
    }
  ]);
  */
});


/*
 * This is the API for adding a new member to the list
 * 
 * It expects an application/json payload as follows:
 *  'number': phone number
 *  'firstName': 
 *  'lastName': 
 *  'isAdmin': boolean
 * 
 * TODO figure out how auth works!
 */
app.post('/addMember', function (req, res) {
  // Get the JSON body out of the request
  let member = {};
  try {
    member = req.body;
  } catch (e) {
    res.status(400).send('Invalid JSON Payload');
  }
  /*
  memberList.addMember(member)
    .then(r => {
      console.log(r);
      res.status(r.status).send(r.message);
    })
    .catch(e => {
      console.log(r);
      res.status(e.status).send(e.message)
    });
    */
    memberList.addMember(member, function(err, dbResult){
      if (err) {
        res.status(500).send(err.message);
      } else {
        res.status(dbResult.status).send(dbResult.message);
      }
    })
  });

/*
 * This is the API for updating an existing member the list
 * 
 * It expects an application/json payload as follows with the full member info
 * 
 * TODO figure out how auth works!
 */
app.post('/updateMember', function (req, res) {
  // Get the JSON body out of the request
  let member = {};
  try {
    member = req.body;
  } catch (e) {
    res.status(400).message('Invalid json member data');
  }

  // If the phone number has changed, delete the old entry and replace it
  if (member._id != idFromNumber(member.number)) {
    let newNumber = member;
    memberList.deleteMember(member, function(err, dbResult) {
      if (err) {
        res.status(500).send(err.message);
      } else {
        newNumber._id = idFromNumber(newNumber.number);
        memberList.addMember(newNumber, function(err, dbResult) {
          if (err) {
            res.status(500).send(err.message);
          } else {
            res.status(dbResult.status).send(dbResult.message);
          }    
        });
      }
    });
  } else {
    memberList.updateMember(member, function(err, dbResult) {
      if (err) {
        res.status(500).send('Unknown Error');
      } else {
        res.status(dbResult.status).send(dbResult.message);
      }    
    });
  }
});



/*
 * This is the API for adding a delete a member to the list
 * 
 * It expects an application/json payload as follows:
 *  '_id': key of member to delete
 * 
 * TODO figure out how auth works!
 */
app.post('/deleteMember', function (req, res) {
  // Get the JSON body out of the request
  let member = {};
  try {
    member = req.body;
  } catch (e) {
    res.status(400).send('Invalid JSON Payload');
  }
  memberList.deleteMember(member, function(err, dbResult) {
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.status(dbResult.status).send(dbResult.message);
    }    
  });
});

/*
// TODO need to add authentication to this app somehow
app.post('/tropo_login', function (req, res) {
  var sess = req.session;
  debug('In t/ropo_login with session id: %s', sess.id);
  var myPapiUser = new papiUsers(papiUri, req.body.tropo_user, req.body.tropo_pw);
  //myPapiUser.lookupUserRoles(req.body.tropo_user, request, checkUserRoles(req, res));
  myPapiUser.lookupUserRoles(req.body.tropo_user, request)
    .then(function (roles) {
      checkUserRoles(req, res, roles);
    })
    .catch(function(err){
      console.log('Failed getting Tropo Webhook Data Object:'+err.message);
      var msg = ' <br><a href=\'./\'>Try Again?</a>';
      msg = 'FAIL: Lookup User Roles failed:' + err.message + msg;
      console.log(msg);
      return res.send(msg);
    });
});
*/

/*
   * This is the API for sending a single SMS to one or more destinations
   * 
   * It expects an application/json payload as follows:
   *   message: text of message to send
   *   numbers: comma seperated list of phone numbers to deliver the message to
   * 
   * When a valid request body is received a request is made to a cPaaS provider
   * to send the messages
*/
app.post('/sendMessage', function (req, res) {
  cPaasConnector.processSendRequest(req, res, myWebhookData);
  //TODO implement a mechanism to timeout if we never hear back from the cPaaS
});

/*
   * This is the URL that a cPaaS provider calls back to in response to a request
   * In the case of Tropo, the response is typically to ask (again) for the message to be sent
   * 
   * It expects an app%lication/json payload that provides the details of
   * the message to send and the numbers to send it to
   * 
   * In the case of Tropo, the platform takes these as request parameters from the
   * initial request and sends them back here for further processing
   * 
   * When a valid response is received the actual request to send the messages is made to the cPaaS
   * 
   * This route will also respond to the previous /sendMessage request using the cPaaS response
*/
app.post('/initialCPaaSUrl', function (req, res) {
  cPaasConnector.processInitialCallback(req, res);
});

/*
// TODO remove this when I figure out my auth strategy...its not this
// This function checks if the user is a Tropo employee
function checkUserRoles(req, res, roles) {
    req.session.papiLoginCompleted = false;
    var msg = ' <br><a href=\'./\'>Try Again?</a>';
    if ((!roles) || (roles.length <= 0)) {
      msg = 'Tropo account does not belong to an employee.<br>' +
        'Contact Support if you believe this is incorrect.' + msg;
      console.log(msg);
      return res.send(msg);
    } else {
      var found = false;
      for (var i=0; i<roles.length; i++) {
        role= roles[i];
        if (role.roleName == 'EMPLOYEE') {found=true; break;}
      }
      if (found) {
        req.session.papiLoginCompleted = true;
        displayForm(res);
      } else {
        msg = 'Tropo account does not belong to an employee.<br>' +
          'Contact Support if you believe this is incorrect.' + msg;
        console.log(msg);
        return res.send(msg);
      }
    }
}
*/

/* I may need this when I register my webhooks
// TODO Update webhook handler to write data to member db
app.post('/tropoWebhooks', function (req, res) {
  var payload = req.body;
  console.log('Webhook fired:');
  console.log(payload);
  if (('undefined' == typeof(payload.data)) || ('undefined' == typeof(payload.event))) {
    console.log('No data in webhook receiver');
    res.sendStatus(200);
    return;
  } 

  if ('undefined' != typeof(payload.data.sessionId)) {  
    myWebhookData.getWebhookDataForTropoSession(payload.data.sessionId)
      .then(function (webhookData) {
        if (payload.event === 'smsdlr') {
          webhookData.smsDeliveryReceipt = payload;
          webhookData.smsDeliveryTime = m.utc();
        } else if (payload.event === 'cdrCreated') {
          webhookData.cdrCreatedData = payload;
          webhookData.cdrRatedTime= m.utc();
        } else if (payload.event === 'ratedCdr') {
          webhookData.cdrRatedData = payload;
          webhookData.cdrCreatedTime = m.utc();
        } else {
          console.log('Got an unexpected webhook event: ' + payload.event);
        }
      })
      .catch(function(err){
        console.log('Failed getting Tropo Webhook Data Object:'+err.message);
      });
  } else {
    console.log('No id in webhook data.');
  }
  res.sendStatus(200);
});

/*
//TODO figure out if I even care about this anymore....
// I'd delete it but I'm not sure who calls it.
app.get('/showEvents', function (req, res) {
  console.log('Displaying the events...');
  var sessionId = req.query.sessionId;
  // Get the webhook data object associated with this Tropo Session ID
  myWebhookData.getWebhookDataForTropoSession(sessionId)
  .then(function (webhookData) {
    webhookData.lastViewTime = m.utc();
    res.writeHead(200, {'content-type': 'text/html'});
    res.write('<html><body>')
    res.write('<script>\nif (!sessionStorage.getItem(\'timezone\')) {var tz = jstz.determine() || \'UTC\'; sessionStorage.setItem(\'timezone\', tz.name());} </script>');
    res.write('<H2>Webhook Data As Of: '+ webhookData.lastViewTime.format('hh:mm:ss')+' UTC</H2>')
    if (webhookData.cdrCreatedTime) {
      res.write('<H4>Unrated CDR Event Received: '+ webhookData.cdrCreatedTime.format('hh:mm:ss')+' UTC</H4><br>');
      res.write('<textarea rows=\'10\' cols=\'80\' style=\'border:none;\'>');
      res.write(JSON.stringify(webhookData.cdrCreatedData));
      res.write('</textarea>');
    } else {
      res.write('<H4>No Unrated CDR Event Received Yet.</H4><br>');      
    }
    if (webhookData.cdrRatedTime) {
      res.write('<H4>Rated CDR Event Received: '+webhookData.cdrRatedTime.format('hh:mm:ss')+' UTC</H4><br>');
      res.write('<textarea rows=\'10\' cols=\'80\' style=\'border:none;\'>');
      res.write(JSON.stringify(webhookData.cdrRatedData));
      res.write('</textarea>');
    } else {
      res.write('<H4>No Rated CDR Event Received Yet.</H4><br>');      
    }
    if (webhookData.smsDeliveryTime) {
      res.write('<H4>SMS Delivery Receipt Received: '+webhookData.smsDeliveryTime.format('hh:mm:ss')+' UTC</H4><br>');
      res.write('<textarea rows=\'10\' cols=\'80\' style=\'border:none;\'>');
      res.write(JSON.stringify(webhookData.smsDeliveryReceipt, null, 4));
      res.write('</textarea>');
    } else {
      res.write('<H4>No SMS Delivery Receipt Event Received Yet.</H4><br>');      
    }
    res.write('<p><a href=\'/showEvents\?sessionId='+sessionId+'>Refresh View of Event Data</a></body></html>');
    res.end('<p><a href=\'/\'>Return to form to Try again</a></body></html>');
  })
  .catch(function (err) {
    console.log('Failed to find/create webhook data object for this Tropo request...');
    res.writeHead(200, {'content-type': 'text/html'});
    res.write('<html><body>Failed to find/create webhook data object for this Tropo request. Your session may have timed out.<br>');
    res.write(err.message);
    res.end('<p><a href=\'/\'>Return to form to Try again</a></body></html>');
  });
});
*/

// Helper function for getting a E.164 ID from a user entered number
function idFromNumber(number) {
  var bare_num = number.replace(/\D/g, '');
  if (bare_num.length === 10) {
    return ('+1'+bare_num);
  } else if ((bare_num.length === 11) && (bare_num[0] === '1')) {
    return ('+'+bare_num);
  } else {
    console.error('Can\'t calculate key from '+number);
    return bare_num;
  }
}  
