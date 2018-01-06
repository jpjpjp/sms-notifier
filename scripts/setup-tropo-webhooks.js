/* setup-tropo-webhook.js
 *
 * This script will configure Tropo to send SMS delivery receipts to the sms-notifier server.
 * As input it requires a tropo username and password as well ase
 *  the tropo application ID (created with the the setup-tropo secript)
 *  the url where the server will be deployed
 * 
 * It will create the app name in the Tropo production area 
 * It will get the API Token so that the sms notifier can make outbound requests
 * It will associate two numbers with the app, one number is used to notify members,
 * the other number is used by Admins to broadcast messages and see responses
 * 
 * As output it will suggest the Tropo related environment variables that need to 
 * be set for the sms-notifer application to work with Tropo
 */ 
/* eslint-disable no-console */

// Make http requests to tropo
request = require('request');
//request = request.defaults({jar: true});
// Request Debug library dumps all kinds of info to the console
//require('request-debug')(request);

// The async module makes this code much easier to read an understand
// It does require node version 7.10 or above
async = require('async');

// Everything else can be controlled via cmd line parmeters
commandLineArgs = require('command-line-args');
optionDefinitions = [
  { name: 'tuser', alias: 't', type: String },
  { name: 'pass', alias: 'p', type: String },
  { name: 'appid', alias: 'a', type: String },
  { name: 'url', alias: 'u', type: String }
];
let myArgs = {
  tropoUser: '',
  tropoPassword: '',
  tropoAppId: '',
  url: ''
};
let tropoInfo = {};

if (!parseCmdLineArgs(myArgs)) {
  return;
}


// Configure to register a webhook for SMS delivery notifications
let tropoUrl = 'https://api.tropo.com/rest/v1/';
let smsDlrBody = {
  'event': 'smsdlr',
  'name': 'SMS Notifier Delivery Receipt Handler',
  'targetUrl': myArgs.url + 'smsDeliveryReceiptHandler',
  'resource': 'sms',
  'payload': {'webhookSecret': 'This could have stronger security!'},
  // Perhaps I need to add the accountID field
  'enabled': true
};
let papiOptions = {
  url: tropoUrl + 'applications/' + myArgs.tropoAppId + '/webhooks',
  method: 'POST',
  auth: {'user': myArgs.tropoUser, 'pass': myArgs.tropoPassword},  
  headers: {'Content-Type': 'application/json', 'cache-control': 'no-cache'},
  body: JSON.stringify(smsDlrBody)
};


callPapi(request, papiOptions)  // First check if there are numbers for the requested area code
.then(response => {
  console.log('SMS Delivery Receipts will be sent to '+myArgs.url + 'smsDeliveryReceiptHandler');
  console.log('Send a DELETE to this url to turn this off: '+response.href);
})
.catch(err => {
  // TODO clean up a half set up app
  console.log('Failed to setup webhook');
  console.error(err.message);
});


/* Helper method to call PAPI and return a promise */
function callPapi(request, options) {
	// Call the PAPI lookup method.
  return new Promise(function (resolve, reject) {
    request(options, function(err, res) {
      //Check for any unexpected status codes
      if (err) return reject(err);
    	if(res.statusCode !== 200) {
        let errMessage = 'Invalid Status Code Returned:'+ res.statusCode;
    	  console.log(errMessage);
        return reject(new Error(errMessage));
      }
    	// If we got here, we have a good 200 OK Response
      // TODO handle pagination
    	try {
        let data = JSON.parse(res.body);
        resolve(data);
    	} catch (e) {
        reject(err);
    	}
    });
  });
}


function parseCmdLineArgs(myArgs) {
  var getUsage = require('command-line-usage');
  var sections = [
    {
      header: 'setup-tropo-tool',
      content: 'Configure a Tropo App to work with the sms-notifier application'
    },
    {
      header: 'All four params are Required',
      optionList: [
        {
          name: 'tuser, -t',
          typeLabel: '[underline]{ie: sampleUser}',
          description: 'Username of a Tropo account that is setup for production and outbound permissions'
        },
        {
          name: 'pass, -p',
          typeLabel: '[underline]{ie: samplePassword}',
          description: 'Password for Tropo account.'
        },
        {
          name: 'appid, -a',
          typeLabel: '[underline]{ie: 543210}',
          description: 'Required. ID of the application created with tropo-setup script.  Login to https://www.tropo.com/applications to find yours'
        },
        {
          name: 'url, -u',
          typeLabel: '[underline]{ie: https://myappname.herokuapp.com}',
          description: 'Required. The URL where your app will be deployed.  Tropo will callback to this to run the app.'
        }
      ]
    }
  ];
  var usage = getUsage(sections);

  var options;
  try {
    options = commandLineArgs(optionDefinitions);
  } catch (err) {
    console.log(err.message);
    console.log(usage);
    return(false);
  }

  if (options.help !== undefined) {
    console.log(usage);
    return(false);
  }
  if ((!options.tuser) || (!options.pass) || (!options.appid) || (!options.url)) {
    console.log('Missing required arguments');
    console.log(usage);
    return(false);
  } else {
    myArgs.tropoUser = options.tuser;
    myArgs.tropoPassword = options.pass;
    myArgs.tropoAppId = options.appid;
    myArgs.url = options.url;
    if (myArgs.url[myArgs.url.length-1] !== '/') {
      myArgs.url += '/';
    }
  }
  return(true);
}
