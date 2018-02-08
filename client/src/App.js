import React, { Component} from 'react';
import { Navbar, Button } from 'react-bootstrap';
import Parser from 'html-react-parser';
import logo from './logo.png';
import './App.css';

let orgName = '';
let orgUrl = '';
if ((!process.env.REACT_APP_ORGANIZATION_NAME) || (!process.env.REACT_APP_ORGANIZATION_URL)) {
  alert('Cound\'t read the ORGANIZATION_NAME config from the environment');    
} else {
  orgName = process.env.REACT_APP_ORGANIZATION_NAME;
  orgUrl = process.env.REACT_APP_ORGANIZATION_URL;
}


class App extends Component {
  goTo(route) {
    this.props.history.replace(`/${route}`);
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
        <div className='navbar-header'>
          <div className='nav navbar-nav navbar-left'>
            <a href={Parser(orgUrl)}>
              <img src={logo} className='logo-left' alt='logo' />
            </a>
            <h1 className='navbar-brand'>Welcome to the {Parser(orgName)} SMS Notifier</h1>
          </div>
          <div className='second-button'>
            {
              !isAuthenticated() && (
                <Button
                  bsStyle='primary'
                  className='btn-margin'
                  onClick={this.login.bind(this)}
                >
                  Log In
                </Button>
              )
            }
            {
              isAuthenticated() && (
                <Button
                  bsStyle='primary'
                  className='btn-margin'
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
