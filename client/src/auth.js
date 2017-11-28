import auth0 from 'auth0-js';
import history from './history';

export default class Auth {
  auth0 = new auth0.WebAuth({
    domain: 'albany-bike-resue.auth0.com',
    clientID: 'lM1xONo6ZIXx3se41jnVAD10ia2DRzCq',
    redirectUri: 'https://localhost:3000/callback',
    audience: 'localhost:1185',
    responseType: 'token id_token',
    scope: 'openid'
  });

  constructor() {
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.handleAuthentication = this.handleAuthentication.bind(this);
    this.isAuthenticated = this.isAuthenticated.bind(this);
    if (process.env.REACT_APP_OAUTH_CALLBACK) {
      this.auth0.redirect.baseOptions.redirectUri = process.env.REACT_APP_OAUTH_CALLBACK;
    } else {
      alert('Cound\'t read the REACT_APP_OAUTH_CALLBACK from the environment');
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
    localStorage.setItem('Authorization', 'Bearer ' + authResult.accessToken)
    // navigate to the home route
    history.replace('/home');
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