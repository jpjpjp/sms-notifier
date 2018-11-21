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

// Tropo and Mongo modules read config from environment
if (process.env.NODE_ENV !== 'production') {
  // We use a .env file in our dev environment
  const dotenv = require('dotenv');
  dotenv.load();
}


// Express Setup
var express = require('express'),
  app     = express(),
  port    = parseInt(process.env.PORT, 10) || 1185;
var bodyParser = require('body-parser');
var debug = require('debug')('SMSNotifierServer');

// Libs for validating JWTs
var jwt = require('express-jwt');
var jwks = require('jwks-rsa');
var jwtCheck = jwt({
  secret: jwks.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: 'https://' + process.env.REACT_APP_OAUTH_DOMAIN + '/.well-known/jwks.json'
  }),
  audience: process.env.REACT_APP_OAUTH_AUDIENCE,
  issuer: 'https://' + process.env.REACT_APP_OAUTH_DOMAIN + '/',
  algorithms: ['RS256'] // TODO Use env var
});

//app.use(jwtCheck);

// Create the connector to talk to the cPaaS (Communication Platform as a Service)
if (!process.env.CPAAS_IS_TWILIO) {
  // We use Tropo
  // This module needs the memberList object so we initialize it in the callback 
  // of the Member list constructor
  var TropoConnector = require('./tropo-connector.js');
} else {
  // We use Twilio
  var TwilioConnector = require('./twilio-connector.js');
}
var cPaasConnector = {};

// Create the MemberList to talk to the database and maintain member list
var MemberList = require('./member-list.js');
var memberList = new MemberList(function (err, msg) {
  if (err) {
    return console.error(err.message);
  } else {
    console.log(msg);
    // Now that the deb is wired up, initalize the cPaaS module
    if (!process.env.CPAAS_IS_TWILIO) {
      cPaasConnector = new TropoConnector(memberList);
    } else {
      cPaasConnector = new TwilioConnector(memberList);
    }

    // And start our server listening for requests....
    app.listen(port);
    console.log('server listening on ' + port);
  }
});

// Set Express Routes and fire up the server
// We need the cookie-parser and express-session in order to get
// a unique session ID per browser instance
//var cookieParser = require('cookie-parser');
/*
var session = require('express-session');
//app.use(cookieParser());
app.use(session({
  secret: '34SDgsdgspxxxxsdfsaxxxdfsG', // just a long random string
  resave: false,
  saveUninitialized: true
}));
*/
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
if ((process.env.NODE_ENV === 'production') || (process.env.DEV_MODE === 'production')) {
  console.log('Running in production mode with static client assets.');
  app.use(express.static('client/build'));
}
// The server gets started in the callbacks from the support module constructors
// See above

app.get('/authorized', function (req, res) {
  res.send('Secured Resource');
});

// Set Express Routes and fire up the server
// TODO This can probably be updated to a keep alive of sorts
// Nonetheless we need a was to set up sessions
app.get('/', function (req, res) {
  debug('Got a GET request to /');
  res.sendFile(__dirname + '/client/build/index.html');
});

app.get('/callback', function (req, res) {
  if (process.env.NODE_ENV !== 'production') {
    res.status(400).send('callback endpointed not supported in non production environments');
  }
  debug('Auth callback landed on server, will redirect to react for client side handling');
  res.sendFile(__dirname + '/client/build/index.html');
});

/** 
 * Routes for managing the member list
 * 
 * @function /getMembers
 * @function /addMember
 * @function /updateMember
 * @function /deleteMember
 * 
 * We expect the react client to call these routes
 * These routes are all secured by checking with an access token
 */

 // Provide the list of members to the client
app.get('/getMemberList', jwtCheck, function (req, res) {
  memberList.getMemberList(function (err, list) {
    if (err) {
      console.error(err.message);
      res.status(500).send(err.message);
    }
    res.send(list);
  });
});


/*
 * This is the API for adding a new member to the list
 * 
 * It expects an application/json payload as follows:
 *  'number': phone number
 *  'firstName': 
 *  'lastName': 
 *  'isAdmin': boolean
 */
app.post('/addMember', jwtCheck, function (req, res) {
  // Get the JSON body out of the request
  let member = {};
  try {
    member = req.body;
  } catch (e) {
    res.status(400).send('Invalid JSON Payload');
  }
  memberList.addMember(member, function(err, dbResult){
    if (err) {
      res.status(500).send(err.message);
    } else {
      res.status(dbResult.status).send(dbResult.message);
    }
  });
});

/*
 * This is the API for updating an existing member the list
 * 
 * It expects an application/json payload as follows with the full member info
 */
app.post('/updateMember', jwtCheck, function (req, res) {
  // Get the JSON body out of the request
  let member = {};
  try {
    member = req.body;
  } catch (e) {
    res.status(400).message('Invalid json member data');
  }

  // If the phone number has changed, delete the old entry and replace it
  if (member._id != cPaasConnector.idFromNumber(member.number)) {
    let newNumber = member;
    memberList.deleteMember(member, function(err) {
      if (err) {
        res.status(500).send(err.message);
      } else {
        newNumber._id = cPaasConnector.idFromNumber(newNumber.number);
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
 */
app.post('/deleteMember', jwtCheck, function (req, res) {
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

/** 
 * This is the API for sending a single SMS to one or more destinations
 * 
 * @function /sendMessage
 * It expects an application/json payload as follows:
 *   message: text of message to send
 *   numbers: comma seperated list of phone numbers to deliver the message to
 * 
 * When a valid request body is received a request is made to a cPaaS provider to send the messages
 * 
 * We expect the react client to call these routes
 * These routes are all secured by checking with an access token
*/
app.post('/sendMessage', jwtCheck, function (req, res) {
  cPaasConnector.processSendRequest(req, res);
  //TODO implement a mechanism to timeout if we never hear back from the cPaaS
});


/** 
 * Routes for the cPaas to call back into
 * 
 * @function /initialCPaaSUrl
 * @function TODO webhook url
 * 
 * We expect the the cPaaS to call these routes
 * These routes are not secured an access token
 */


/*
   * This is the URL that a cPaaS provider calls back to in response to a request
   * In the case of Tropo, the response is typically to ask (again) for the message to be sent
   * 
   * It expects an application/json payload that provides the details of
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
   * This is the URL that a cPaaS provider calls to provide SMS Delivery receipts
   * In the case of Tropo, the response is generally ignored
   * 
   * It expects an application/json payload that provides the Delivery Info
*/
app.post('/smsDeliveryReceiptHandler', function (req, res) {
  cPaasConnector.processSmsDlr(req, res);
});

