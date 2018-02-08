# sms-notifier

This project provides a gui to allow organizations such as non profits to manage a membership list and to send text messages to that list.  Once set up administrators can send text messages to their organization simply by sending a message to the organization's adminstration number.

The application is a node express server with a react front end.

## Configuring the server

The server relies on three external services that must be set up and configured before it will work.<br>
<br> 1) **Tropo cPaaS** (Communication Platform as a Service).   
<br> This service provides the phone numbers and does the actual text messaging.   Prior to running the application, a Tropo account should be created at www.tropo.com.  Add a payment method, and contact support to have outbound privleges enabled.
<br> Once an account is available a Tropo WebAPI application must be setup and phone numbers must be configured to user our applciation.   This step is automated with the <a href='./scripts/setup-tropo.js'> setup-tropo.js</a> script.   After Tropo is setup the following environment variables need to be set.  The script provides the correct values
<ul>
<li>TROPO_API_KEY -- Token used by our app to request services from Tropo
<li>TROPO_PUBLIC_NUMBER -- The number that will send messages to members of our organization
<li>TROPO_ADMIN_NUMBER -- The number that admins will see member responses on.  Admins can also text this number to broadcast to all members.
</ul>
Note that all tropoe code is localized to <a href='./tropo-connector.js'>tropo-connector.js</a>.   It should be possible to create a new module to use a different cPaaS.<br>

<br>2) **MongoDB Altas** provides the cloud storage of the membership list.  A free or paid account must be setup at https://www.mongodb.com/cloud/atlas.  
<br>Once configured the following environment variables need to be set:
<ul>
<li>MONGO_DB = The name of the database set up in the configuration phase
<li>MONGO_DB_COLLECTION = The name of the collection set up in the configuration phase
<li>MONGO_URL -- the connection string to the database collection that was setup during the configuration phase
<li>MONGO_DB_USER 
<li>MONGO_DB_PASSWORD
</ul>
Note that all mongo code is localized to <a href='./member-list.js'>member-list.js</a>.   It should be possible to create a new module to use a different database.<br>

<br>
3) **Auth0** provides the identity and authorization service.   When users navigate to our web page they are redirected to Auth0 to sign in.   Upon succesful login Auth0 provides a JWT token which is used to validate calls to the server.   A free or paid account must be set up at https://auth0.com/.   
 
On auth0.com, create a Single Page Web Application client.   In the Quick Start, specify React as the web app technology.   On the settings tab populate the Allowed Callback URLs.  Typically this will include http://localhost:3000/callback when initially building your app and will change to the URL where your server is running when not in debug mode. https://localhost:1185/callback, https://localhost:1185/callback, https://abr-sms-tool.herokuapp.com/callback.   Save the client Settings<br>

Once the client is setup, we need to set up the API that our server provides, so that when clients log into our web app, the Auth0 client will provide them with a JWT that will allow the react app to call the APIs in our server. This process is described here: https://auth0.com/docs/apis#how-to-configure-an-api-in-auth0  Briefly, in Auth0 click on the APIs menu on the left and click the "Create API" button in the upper right hand corner.  The new API needs a name and an Identifier.   This Identifier will be used to set the REACT_APP_OAUTH_AUDIENCE environment variable in the next step.   Accept the default RS256 signing algorithm.

Once configured the following environment variables need to be set:
<ul>
<li>REACT_APP_OAUTH_DOMAIN -- domain name setup in the configuration step
<li>REACT_APP_OAUTH_AUDIENCE -- audience name setup in the configuration step
<li>REACT_APP_OAUTH_CALLBACK -- provided by Auth0 durig the setup
<li>REACT_APP_OAUTH_CLIENT_ID -- provided by Auth0 durig the setup
</ul>
All four of these environment variables are used by the react client code.  The REACT_APP_OAUTH_DOMAIN and the REACT_APP_OAUTH_AUDIENCE are also used by the server.  If you use the dotenv library to set environment variables make sure to set these in both the project root and the client subdirectory.

Note that all auth0 code is localized to <a href='./client/src/auth.js'>auth.js</a>.   It should be possible to create a new module to use a identity provider.<br>

Prior to running the applciation, the Auth0 owner needs to set up at least one user in the Auth0 system so that they can login to the sms-notifier app.

## Running the server

The react client was built using the <a href='https://github.com/facebookincubator/create-react-app'>create-react-app</a> package.   During development it runs on localhost:3000, by running 'npm start' in the client directory.   Run 'npm run build' in the client directory to build the packaged client.  You can tell your server running locally to serve your optimized build by setting the environment variable DEV_MODE to 'production'.

<br>The server starts with node start in the root directory.  Note that the URL where the server runs is needed during the Tropo configuration phase, so that a Tropo WebAPI app can be configured to call into our server to process requests.

## Testing the server

This package comes with postman collection to exercise the APIs called by the web client and to emulate incoming texts to the public and admin numbers.   The collection can be loaded into Postman and run using the Postman Runner, or if Postman's newman tool is installed they can be run from the command line by typing:

    npm test

The Postman scripts require the the following environment variables to be set:
<ul>
<li>url -- url where the sms-notifier server is running (ie: localhost:1185)
<li>sms_recipient -- phone number of a tester to get SMS messages sent from the test run.  Ideally this will be the number of an active member in the system under test.
<li>public_number -- the public number of the system under test (same as TROPO_PUBLIC_NUMBER)
<li>admin_number -- the admin number of the system under test (same as TROPO_ADMIN_NUMBER)
<li>org_name -- The name of the organization the system is set up for.
<li>auth_domain -- The domain set up in Auth0.   This is available in the Clients/Setting menu at manage.auth0.com
<li>auth_client_id -- The client id for the non-interactive Test Client that is automatically created when you set up a single page applciation client in Auth0.   This is available in the Clients/Setting menu at manage.auth0.com
<li>auth_client_secret -- The client secret set up or the non-interactive Test Client in Auth0.   This is available in the Clients/Setting menu at manage.auth0.com. Click the checkbox to "Reveal Client Secret"
<li>auth_audience -- The API Audience set up in Auth0.  This is avialble in the APIs menu of at manage.auth0.com
</ul>

A stub postman-environment.json is included with this project.  Simply replace all the "[POPULATE ME]" sections as described above

## Using the website

After succesful login the administrator is provided with a form to send SMS and a table to manage members.   By default any text messages sent from the web console are sent to all members who have not opted out.   This behavior can be overridded by manually selecting/deselecting the members who should receive the message.

## Using the service via text messages

Once the member list is set up, Admins have the ability to manage communications without using the web console by sending texts to the TROPO_ADMIN_NUMBER.   By default this will "broadcast" that message to all members who have not opted out.   If an administrators messages to the admin numbers begins with "Reply [number]" the message is sent only to the number and not broadcast.  All other Admininstrators receive a text notification that this was done.

When members (or anyone really) sends a text to the TROPO_PUBLIC_NUMBER, that message is forwarded to all the Admins, who can use the "Reply" functionality described above to answer that member directly.  If anyone other than an Administrator sends a text to the TROPO_ADMIN_NUMBER they receive a response saying that this is not allowed and to contact the staff at the organization.

## TO-DO:

See <a href='./todo.txt'>todo.txt</a>