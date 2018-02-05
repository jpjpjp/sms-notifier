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

<br>
2) **MongoDB Altas** provides the cloud storage of the membership list.  A free or paid account must be setup at https://www.mongodb.com/cloud/atlas.  TODO, describe setup.  
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

<br>The server starts with node start in the root directory.  Note the the URL where the server runs is needed during the Tropo configuration phase, so that a Tropo WebAPI app can be configured to call into our server to process requests.

## Testing the server

TODO--JP has a set of postman tests.  Sanitize and add them to the repository.

## Using the server

After succesful login the administrator is provided with a form to send SMS and a table to manage members.

## TO-DO:

See <a href='./todo.txt'>todo.txt</a>