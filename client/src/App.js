import React, { Component} from 'react';
import { Navbar, Button } from 'react-bootstrap';
import logo from './abr-logo.png';
import './App.css';

class App extends Component {
  goTo(route) {
    this.props.history.replace(`/${route}`)
  }

  login() {
    this.props.auth.login();
  }

  logout() {
    this.props.auth.logout();
  }

  render() {
    const { isAuthenticated } = this.props.auth;
    
    return (
      <Navbar fluid>
        <div className="navbar-header">
          <div className="nav navbar-nav navbar-left">
            <a href="http://www.albanybikerescue.org/">
              <img src={logo} className="logo-left" alt="logo" />
            </a>
            <h1 className="navbar-brand">Welcome to the Albany Bike Rescue SMS Notifier</h1>
          </div>
          <div className="second-button">
            {
              !isAuthenticated() && (
                  <Button
                    bsStyle="primary"
                    className="btn-margin"
                    onClick={this.login.bind(this)}
                    >
                    Log In
                  </Button>
                )
            }
            {
              isAuthenticated() && (
                  <Button
                    bsStyle="primary"
                    className="btn-margin"
                    onClick={this.logout.bind(this)}
                  >
                    Log Out
                  </Button>
                )
            }
          </div>
        </div>
      </Navbar>
    );
  }
}

export default App;
