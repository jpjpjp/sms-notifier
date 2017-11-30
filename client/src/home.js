import React, { Component} from 'react';
import SMSForm from './sms-form';
import MemberTable from './member-table';

import './App.css';

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
      dbInitiatalized: false, dbConnected: false};
  }

  login() {
    this.props.auth.login();
  }
  logout() {
    this.props.auth.logout();
  }

  componentDidMount(){
    fetch('/getMembers', {
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
          if (res.message) {throw(new Error(res.message));}
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
          // How do I delete this bad boy?
          return alert('Writing to DB failed: ' + res.status);
        }
        users.push(row);
        let numbers = this.state.numbers;
        numbers.push(row.numbers);
        let selected = this.state.selected;
        selected.push(row._id);
        this.setState({ users: users, numbers: numbers, selected: selected });  
      })
      .catch(e => {
        this.setState({ dbConnected: false });
        return alert('Writing to DB failed: ' + e.response.status);
      });
  }

  onFormDataUpdate = (row, cellName, cellValue, indices) => {
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

  render() {
    const { isAuthenticated } = this.props.auth;   
    return (
      <div className='App'>
        {
          isAuthenticated() && (
            <div className='Message Form'>
              <div className='SMS-Form'>
                <SMSForm getNumbers={this.getNumbers}/>
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
                />
              </div>
            </div>
          )
        }
        {
          !isAuthenticated() && (
            <h4>
                You are not logged in! Please{' '}
              <a
                style={{ cursor: 'pointer' }}
                onClick={this.login.bind(this)}
              >
                Log In
              </a>
              {' '}to continue.
            </h4>
          )
        }
      </div>
    );
  }
}

export default Home;
