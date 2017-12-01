import auth0 from 'auth0-js';
import history from './history';


var dotenv = require('dotenv');
dotenv.load();

if((!process.env.REACT_APP_OAUTH_CALLBACK) || (!process.env.REACT_APP_OAUTH_DOMAIN) || 
  (!process.env.REACT_APP_OAUTH_CLIENT_ID) || (!process.env.REACT_APP_OAUTH_AUDIENCE)) {
  alert('Cound\'t read the OAUTH config from the environment');    
}

/*
  alert(process.env.REACT_APP_OAUTH_DOMAIN+', '+process.env.REACT_APP_OAUTH_CLIENT_ID+ ', ' +
    process.env.REACT_APP_OAUTH_CALLBACK+', '+process.env.REACT_APP_OAUTH_AUDIENCE);
*/


export default class Auth {
  auth0 = new auth0.WebAuth({
    domain: process.env.REACT_APP_OAUTH_DOMAIN,
    clientID: process.env.REACT_APP_OAUTH_CLIENT_ID,
    redirectUri: process.env.REACT_APP_OAUTH_CALLBACK,
    audience: process.env.REACT_APP_OAUTH_AUDIENCE,
    responseType: 'token id_token',
    scope: 'openid'
  });

  constructor() {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.handleAuthentication = this.handleAuthentication.bind(this);
    this.isAuthenticated = this.isAuthenticated.bind(this);
    //If I'm emulating production mode in my local dev environment I reset the callback to hit my express server
    if (process.env.DEV_MODE === 'production') {
      this.auth0.redirect.baseOptions.redirectUri = 'http://localhost:1185/callback';
      alert('Reset callback to '+ this.auth0.redirect.baseOptions.redirectUri);
    }
  }

  handleAuthentication() {
    this.auth0.parseHash((err, authResult) => {
      if (authResult && authResult.accessToken && authResult.idToken) {
        this.setSession(authResult);
        history.replace('/home');
      } else if (err) {
        history.replace('/home');
        console.log(err);
      }
    });
  }

  setSession(authResult) {
    // Set the time that the access token will expire at
    let expiresAt = JSON.stringify((authResult.expiresIn * 1000) + new Date().getTime());
    localStorage.setItem('access_token', authResult.accessToken);
    localStorage.setItem('id_token', authResult.idToken);
    localStorage.setItem('expires_at', expiresAt);
    localStorage.setItem('Authorization', 'Bearer ' + authResult.accessToken);
    // navigate to the home route
    history.replace('/home');
  }

  isSessionExpired(statusCode) {
    if (statusCode === 401) {
      this.logout();
      return true;
    }
    return false;
  }

  logout() {
    // Clear access token and ID token from local storage
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('expires_at');
    // navigate to the home route
    history.replace('/home');
  }

  isAuthenticated() {
    // Check whether the current time is past the 
    // access token's expiry time
    let expiresAt = JSON.parse(localStorage.getItem('expires_at'));
    return new Date().getTime() < expiresAt;
  }

  login() {
    this.auth0.authorize();
  }
}