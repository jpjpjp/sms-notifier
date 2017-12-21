/* setup-tropo.js
 *
 * This script will configure Tropo to work with the sms-notifier tool.
 * As input it requires a tropo username and password and an app name
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
  { name: 'name', alias: 'n', type: String },
  { name: 'url', alias: 'u', type: String },
  { name: 'area', alias: 'a', type: String }
];
let myArgs = {
  tropoUser: '',
  tropoPassword: '',
  tropoAppName: '',
  url: ''
};
let tropoInfo = {};

if (!parseCmdLineArgs(myArgs)) {
  return;
}


// Configure for the inital call to create the application
let tropoUrl = 'https://api.tropo.com/rest/v1/';
let applicationsBody = {
  'name': myArgs.tropoAppName,
  'voiceUrl': myArgs.url + 'initialCPaaSUrl',
  'messagingUrl': myArgs.url + 'initialCPaaSUrl',
  'environment': 'https://api.tropo.com/rest/v1/environments/461',  // shared production
  'apiType': 'webapi'
};
let papiOptions = {
  url: tropoUrl + 'exchanges/?areaCode=' + myArgs.areaCode,
  method: 'GET',
  auth: {'user': myArgs.tropoUser, 'pass': myArgs.tropoPassword},  
  headers: {'Content-Type': 'application/json', 'cache-control': 'no-cache'},
};

// Configure the payload to get the token
let tokenBody = {
  'type': 'token',
  'channel': 'messaging'
};

// Configure the payload to get the numbers
let numberBody = {
  'type': 'number',
  'prefix': myArgs.prefix
};

// Configure the payload to register the webhook for SMS Delivery Receipts
let smsDlrBody = {
  'event': 'smsdlr',
  'name': 'SMS Notifier Delivery Receipt Handler',
  'targetUrl': myArgs.url + 'smsDeliveryReceiptHandler',
  'resource': 'sms',
  'payload': {'webhookSecret': 'This could have stronger security!'},
  'enabled': true
};


callPapi(request, papiOptions)  // First check if there are numbers for the requested area code
.then(areaCodeInfo => {
  if ((!areaCodeInfo.length) || (!areaCodeInfo[0].href)) {
    throw new Error('Numbers not avaiable in area code: '+myArgs.areaCode);
  }
  papiOptions.url = tropoUrl + 'applications';
  papiOptions.method ='POST';
  papiOptions.body = JSON.stringify(applicationsBody);
  return callPapi(request, papiOptions);  // If so set up the app
})
.then(appUrl => {
  tropoInfo.appId = appUrl.href.substr(appUrl.href.lastIndexOf('/')+1);
  console.log('Created application named '+myArgs.tropoAppName+', with appID: '+tropoInfo.appId+'...');
  papiOptions.url = appUrl.href + '/addresses';
  papiOptions.body = JSON.stringify(tokenBody);
//  papiOptions.method = 'GET';
//  delete papiOptions.body;
  return callPapi(request, papiOptions); // then get the API token to trigger it
})
.then(tokenInfo=> {
  console.log('Got the API token for App: '+myArgs.tropoAppName+'...');
  tropoInfo.token = tokenInfo.href.substr(tokenInfo.href.lastIndexOf('/')+1);
  papiOptions.body = JSON.stringify(numberBody);
  return callPapi(request, papiOptions); // then get our public number
})
.then(number1 => {
  console.log('Got the main phone number for App: '+myArgs.tropoAppName+'...');
  tropoInfo.publicNumber = number1.href.substr(number1.href.lastIndexOf('/')+1);
  if (tropoInfo.publicNumber[0] === '+') {tropoInfo.publicNumber = tropoInfo.publicNumber.substr(1);}
  return callPapi(request, papiOptions); // then get our admin number
})
.then(number2 => {
  console.log('Got the admin phone number for App: '+myArgs.tropoAppName+'...Setup Complete.');
  tropoInfo.adminNumber = number2.href.substr(number2.href.lastIndexOf('/')+1);
  if (tropoInfo.adminNumber[0] === '+') {tropoInfo.adminNumber = tropoInfo.adminNumber.substr(1);}
  papiOptions.url = tropoUrl + 'applications/' + tropoInfo.appId + '/webhooks';
  papiOptions.body = JSON.stringify(smsDlrBody);
  return callPapi(request, papiOptions); //Finally configure our SMS DLR webhook
})
.then(response => {
  console.log('SMS Delivery Receipts will be sent to '+myArgs.url + 'smsDeliveryReceiptHandler');
  console.log('Send a DELETE to this url to turn this off: '+response.href);
  console.log('Setup Complete.');
  console.log('');
  console.log('Tropo is now configured. Before starting your server, you need to set the following environment variables:');
  console.log('TROPO_API_KEY = "'+tropoInfo.token+'"');
  console.log('TROPO_PUBLIC_NUMBER = "'+tropoInfo.publicNumber+'"');
  console.log('TROPO_ADMIN_NUMBER = "'+tropoInfo.adminNumber+'"');
  console.log('');
})
.catch(err => {
  // TODO clean up a half set up app
  console.error(err.message);
  console.log('Failed to complete setup');
  if (tropoInfo.appId) {
    console.log('Generated an app with id: '+tropoInfo.appId+'. Will clean it up...');
    papiOptions.url = tropoUrl + 'applications/'+tropoInfo.appId;
    papiOptions.method ='DELETE';
    delete papiOptions.body;
    callPapi(request, papiOptions)
    .then(ret => console.log(ret));
  }
})
.catch(err => console.log(err));



/* Helper method to call PAPI and return a promise */
function callPapi(request, options) {
	// Call the PAPI lookup method.
  return new Promise(function (resolve, reject) {
    request(options, function(err, res) {
      //Check for any unexpected status codes
      if (err) {return reject(err);}
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
          name: 'name, -n',
          typeLabel: '[underline]{ie: MyCompanySmsNotifier}',
          description: 'Required. Name of the application to create in Tropo.'
        },
        {
          name: 'url, -u',
          typeLabel: '[underline]{ie: https://myappname.herokuapp.com}',
          description: 'Required. The URL where your app will be deployed.  Tropo will callback to this to run the app.'
        },
        {
          name: 'area, -a',
          typeLabel: '[underline]{ie: 212}',
          description: 'Required. The US area codes for the numbers that the app will use.'
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
  if ((!options.tuser) || (!options.pass) || (!options.name) || 
  (!options.url) || (!options.area)) {
    console.log('Missing required arguments');
    console.log(usage);
    return(false);
  } else {
    myArgs.tropoUser = options.tuser;
    myArgs.tropoPassword = options.pass;
    myArgs.tropoAppName = options.name;
    myArgs.url = options.url;
    if (myArgs.url[myArgs.url.length-1] !== '/') {
      myArgs.url += '/';
    }
    myArgs.areaCode = options.area;
    if (myArgs.areaCode.length !== 3) {
      console.log('Area code argument must be three digits, ie: 212');
      return(false);
    }
    myArgs.prefix = '1'+myArgs.areaCode;
  }
  return(true);
}
