import React, { Component } from 'react';
import logo from './abr-logo.png';
import './App.css';

class App extends Component {
  state = {users: []}

  componentDidMount(){
    fetch('/getMembers')
      .then(res => res.json())
      .then(users => {console.log(users); this.setState({ users })})
      .catch(e => console.error(e));
  }

  render() {
    return (
      <div className="App">
        <header className="Message Form">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to the Albany Bike Rescue SMS Notifier</h1>
        </header>
        <div className="Member-Managment">
          <h1>Membersip List</h1>
          <h3>Messages are sent to the phone number for each member who's row is checked.<br/></h3>   
          <text>By default all members who haven't explicitly opted out of SMS Notifications are checked, but you can modify the recipients for your mesage before hitting the send button.</text>
          {this.state.users.map(user =>
            <div key={user.id}>{user.firstName}</div>
          )};
        </div>
      </div>
    );
  }
}

export default App;
