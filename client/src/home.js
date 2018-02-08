import React, { Component} from 'react';
import SMSForm from './sms-form';
import MemberTable from './member-table';

import './App.css';

let orgName = ''
if (!process.env.REACT_APP_ORGANIZATION_NAME){
  alert('Cound\'t read the ORGANIZATION_NAME config from the environment');    
} else {
  orgName = process.env.REACT_APP_ORGANIZATION_NAME;
}


// Helper for checking for duplicates client side
function findWithAttr(array, attr, value) {
  for(var i = 0; i < array.length; i += 1) {
    if(array[i][attr] === value) {
      return i;
    }
  }
  return -1;
}

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {users: [], numbers: [], selected: [], 
      dbInitiatalized: false, dbConnected: false, sessionExpired: false};
  }

  login() {
    this.props.auth.login();
  }
  logout() {
    this.props.auth.logout();
  }

  componentDidMount(){
    this.onRefreshData();
  }

  onRefreshData = () => {
    fetch('/getMemberList', {
      method: 'get',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('Authorization')
      }
    })
      .then(res => {
        if (res.status === 200) {
          return res.json();
        } else {
          if (this.props.auth.isSessionExpired(res.status)) {
            return this.expireSession();
          }
          if (res.statusMessage) {throw(new Error(res.statusMessage));}
          throw(new Error('Member lookup returned: ' + res.status));
        }
      })
      .then(users => {
        let numbers = [];
        let selected = [];
        for (const i in users) {
          if (users[i].optOut === false){
            numbers.push(users[i].number);
            selected.push(users[i]._id);
          }
        }
        this.setState({ users: users, numbers: numbers, 
          selected: selected, dbInitiatalized: true, dbConnected: true});
        //this.refs.MemberTable.refs.MemberTable.forceUpdate();
      })
      .catch(e => {
        console.error(e.message);
        this.setState({ dbInitiatalized: true });
      });
  }

  onNewUser = (row) => { // eslint-disable-line
    // Fail if this number is already in use
    let users = this.state.users;
    if (findWithAttr(users, '_id', row._id) > 0) {
      alert(row.number+' is already in the member list.');
      return false;
    }

    fetch('/addMember', {
      method: 'post',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('Authorization')
      },
      body: JSON.stringify(row)
    })
      .then(res => {
        if (res.status !== 200) {
          if (this.props.auth.isSessionExpired(res.status)) {
            this.setState({sessionExpired: true});
            return;
          }
          // How do I delete this bad boy?
          return alert('Writing to DB failed: ' + res.status);
        }
        users.push(row);
        let numbers = this.state.numbers;
        numbers.push(row.number);
        let selected = this.state.selected;
        selected.push(row._id);
        this.setState({ users: users, numbers: numbers, selected: selected });  
      })
      .catch(e => {
        this.setState({ dbConnected: false });
        return alert('Writing to DB failed: ' + e.response.status);
      });
  }


  handleAdminChange = (row, cellName, cellValue) => {
    // The table edits don't support boolean so fix it up here
    let msg = '';
    if (cellValue === 'true') {
      row[cellName] = true;
      msg = 'Welcome Admin to the '+orgName+' Texting System\n'+
        'Reply to send texts to all '+orgName+' Members.';
    } else if (cellValue === 'false') {
      row[cellName] = false;
      msg= 'You are no longer an Administrator of the '+orgName+' Texting System\n'+
        'Any messages sent to this number will be ignored.  Bye.';
    }
    else {
      alert(`${cellValue} is an invalid true/false value.  Ignoring Change`);
      return false;
    }
    // Send a message from the Admin number
    fetch('/sendMessage', {
      method: 'POST',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('Authorization')
      },
      body: JSON.stringify({
        message: msg,
        numbers: row.number,
        isAdmin: true,
        adminState: row[cellName]
      }),
    })
      .then(res => {
        if (res.status !== 200) {
          if (this.props.auth.isSessionExpired(res.status)) {
            return this.expireSession();
          }
          alert('Admin Message failed to send.  Status: ' + res.status);
        }
      })    
      .catch(e => {
        alert('Admin Message failed to send.  Status: '+e.message);
      });
  }

  onFormDataUpdate = (row, cellName, cellValue, indices) => {
    // If a user is changing admin status we communicate to them via SMS
    if(cellName === 'isAdmin') {
      this.handleAdminChange(row, cellName, cellValue);
    }
    // push the change to the backend
    fetch('/updateMember', {
      method: 'post',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('Authorization')
      },
      body: JSON.stringify(row)
    })
      .then(res => {
        if (res.status !== 200) {
          if (this.props.auth.isSessionExpired(res.status)) {
            return this.expireSession();
          }
          // How do I delete this bad boy?
          return alert('Writing to DB failed: ' + res.status);
        }
        let users = this.state.users;
        if (cellName === 'number') {
          let numbers = this.state.numbers;
          let i = numbers.indexOf(users[indices.rowIndex].oldNumber);
          if (i >= 0) {
            numbers[i] = cellValue;
            this.setState({ numbers: numbers});
          }
        }  
      })
      .catch(e => {
        this.setState({ dbConnected: false });
        return alert('Writing to DB failed: ' + e.response.status);
      });
  }

  onDeleteUser = (member, index) => {
    fetch('/deleteMember', {
      method: 'post',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Authorization': localStorage.getItem('Authorization')
      },
      body: JSON.stringify(member)
    })
      .then(res => {
        if (res.status !== 200) {
          if (this.props.auth.isSessionExpired(res.status)) {
            this.setState({sessionExpired: true});
            return;
          }
          // How do I delete this bad boy?
          return alert('Removing member from DB failed: ' + res.status);
        }
        let users = this.state.users;
        users.splice(index, 1);
        let numbers = this.state.numbers;
        let selected = this.state.selected;
        let i = selected.indexOf(member._id);
        if (i >= 0) {selected.splice(i,1);}
        i = numbers.indexOf(member.number);
        if (i >= 0) {numbers.splice(i,1);}
        this.setState({ users: users, numbers: numbers, selected: selected });  
      })
      .catch(e => {
        this.setState({ dbConnected: false });
        return alert('Removing member from DB failed: ' + e.response.status);
      });
  }

  onFormRowSelect = (row, isSelected) => {
    let selected = this.state.selected;
    let numbers = this.state.numbers;
    if (isSelected) {
      selected.push(row._id);
      numbers.push(row.number);
    } else {
      let i = selected.indexOf(row._id);
      if (i >= 0) {selected.splice(i,1);}
      i = numbers.indexOf(row.number);
      if (i >= 0) {numbers.splice(i,1);}
    }
    this.setState({numbers: numbers, selected: selected});
    return true;
  }

  onFormSelectAll = (isSelected) => {
    let selected = this.state.selected;
    let numbers = this.state.numbers;
    selected.splice(0,selected.length);
    numbers.splice(0,numbers.length);
    if (isSelected) {
      let users = this.state.users;
      for (let i=0; i<users.length; i++) {
        selected.push(users[i]._id);
        numbers.push(users[i].number);  
      }
    }
    this.setState({numbers: numbers, selected: selected});
    return true;
  }

  getNumbers = () => {
    return this.state.numbers;
  }

  expireSession = () => {
    this.setState({sessionExpired: true});
  }

  render() {
    const { isAuthenticated } = this.props.auth; 
    const loginMessage = (this.state.sessionExpired) ? 'Your session has expired.' :'You are not logged in.';  
    return (
      <div className='App'>
        {
          isAuthenticated() && (
            <div className='Message Form'>
              <div className='SMS-Form'>
                <SMSForm 
                  auth={this.props.auth}
                  getNumbers={this.getNumbers} 
                  expireSession={this.expireSession}
                />
              </div>
              <div className='Member-Table'>
                <MemberTable 
                  ref='MemberTable'
                  dbInitiatalized={this.state.dbInitiatalized}
                  dbConnected={this.state.dbConnected}
                  memberData={this.state.users} 
                  optIns={this.state.selected} 
                  dataUpdateCallback={this.onFormDataUpdate}
                  handleRowSelectCallback={this.onFormRowSelect}
                  handleSelectAllCallback={this.onFormSelectAll}
                  handleNewUser={this.onNewUser}
                  handleDeleteUser={this.onDeleteUser}
                  handleRefreshData={this.onRefreshData}
                />
              </div>
            </div>
          )
        }
        {
          !isAuthenticated() && (
            <h4>
              {loginMessage} Please{' '}
              <a
                style={{ cursor: 'pointer' }}
                onClick={this.login.bind(this)}
              >
                Log In
              </a>
              {(this.state.sessionExpired) ? ' again ' : ' '}to continue.
            </h4>
          )
        }
      </div>
    );
  }
}

export default Home;
