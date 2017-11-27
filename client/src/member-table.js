import React from 'react';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
require('./member-table.css');
require('./react-bootstrap-table-all.min.css');


const Tips = () => (
  <div style={{ textAlign: 'center' }}>
    <em>Tip: Hold shift when sorting to multi-sort!</em>
  </div>
);

const MemberHeader = () => (
  <div className='Member-Managment'>
    <h1>Membersip List</h1>
    <h3>Messages are sent to the phone number for each member who's row is checked.<br/></h3>   
  By default all members who haven't explicitly opted out of SMS Notifications are checked, but you can modify the recipients for your mesage before hitting the send button.
  </div>
);

function onAfterSaveCell(row, cellName, cellValue) {
  alert(`Save cell ${cellName} with value ${cellValue}`);

  let rowStr = '';
  for (const prop in row) {
    rowStr += prop + ': ' + row[prop] + '\n';
  }

  alert('The whole row :\n' + rowStr);
}

function onBeforeSaveCell(row, cellName, cellValue) {
  // You can do any validation on here for editing value,
  // return false for reject the editing
  if (cellName === 'number') {
    if (!isValidUsPhoneNumber(cellValue)) {
      alert(`${cellValue} is an invalid phone number.  Ignoring Change`);
      return false;
    }
    // stash the old value of the number so we can update the numbers array
    row.oldNumber =row.number;
  }
  //ignore if value didn't change
  if (cellValue === row[cellName]) {
    return false;
  }
  return true;
}

function onBeforeNewUser(row, colInfo, errorCb) {
  // You can do any validation on here for editing value,
  // return false for reject the editing
  if ((!row.number) || (!isValidUsPhoneNumber(row.number))) { 
    return (row.number +' is an invalid phone number.');
  }
  if ((!row.firstName) || (!row.lastName)) {
    return ('Both First and Last name are required');    
  }
  row._id = idFromNumber(row.number);
  row.optOut = false;
  row.isAdmin = false;
  row.confirmedSent = 0;
  row.confirmedFailed = 0;

  cellEditProp.onInsertRow(row);
}

/*
function onBeforeSaveCellAsync(row, cellName, cellValue, done) {
  // if your validation is async, for example: you want to pop a confirm dialog for user to confim
  // in this case, react-bootstrap-table pass a callback function to you
  // you are supposed to call this callback function with a bool value to perfom if it is valid or not
  // in addition, you should return 1 to tell react-bootstrap-table this is a async operation.
  // alert(`Before Save cell ${cellName} with value ${cellValue}`);

  // I use setTimeout to perform an async operation.
  setTimeout(() => {
  //   done(true);  // it's ok to save :)
    alert(`Won't save it`);
    done(false);   // it's not ok to save :(
  }, 3000);
  return 1;  // please return 1
}
*/

let cellEditProp = {
  mode: 'click',
  blurToSave: true,
  beforeSaveCell: onBeforeSaveCell, // a hook for before saving cell
  afterSaveCell: onAfterSaveCell  // a hook for after saving cell
};


class MemberTable extends React.Component {
  constructor(props) {
    super(props);
    cellEditProp.afterSaveCell = props.dataUpdateCallback;
    cellEditProp.onDeleteUser = props.handleDeleteUser;
    cellEditProp.onInsertRow = props.handleNewUser;
  }

  onClickDeleteMember(cell, row, rowIndex){
    console.log('Delete Member ID:', cell);
    cellEditProp.onDeleteUser(row, rowIndex);
  }
 
  deleteUserButton(cell, row, enumObject, rowIndex) {
    return (
      <button 
        type='button' 
        className='btn btn-info'
        onClick={() => this.onClickDeleteMember(cell, row, rowIndex)}
      >
        Delete Member
      </button>
    );
  }

  render() {
    if (this.props.memberData.length === 0) {
      return (
        <div className='my-notify-error'>
        Backend not available.  Please try again later.
        </div>
      );
    }
    const selectRow = {
      mode: 'checkbox', //radio or checkbox
      selected: this.props.optIns,
      onSelect:  this.props.handleRowSelectCallback
    };

    const tableOptions = {
      //onAddRow: this.validateNewUser,
      onAddRow: onBeforeNewUser,
      afterInsertRow: cellEditProp.onInsertRow
    };

    return (
      <div>
        <br />
        <MemberHeader />
        <BootstrapTable data={ this.props.memberData } 
          ref='MemberTable'
          cellEdit={ cellEditProp } 
          selectRow={ selectRow }
          options= { tableOptions }
          striped={true} hover={true} condensed={true} insertRow
        >
          <TableHeaderColumn dataField='_id'  hidden hiddenOnInsert isKey={ true } editable={ false }>Key</TableHeaderColumn>
          <TableHeaderColumn dataField='number' dataSort={ true }>Phone</TableHeaderColumn>
          <TableHeaderColumn dataField='firstName' dataSort={ true }>First Name</TableHeaderColumn>
          <TableHeaderColumn dataField='lastName' dataSort={ true }>Last Name</TableHeaderColumn>
          <TableHeaderColumn dataField='isAdmin'  dataFormat={supportedFormatter} hiddenOnInsert >Admin</TableHeaderColumn>
          <TableHeaderColumn dataField='optOut'  dataFormat={supportedFormatter} dataSort={ true } hiddenOnInsert editable={ false } width='8%'>OptOut</TableHeaderColumn>
          <TableHeaderColumn dataField='confirmedSent' dataSort={ true } hiddenOnInsert editable={ false } width='8%'>Arrived </TableHeaderColumn>
          <TableHeaderColumn dataField='confirmedFailed' dataSort={ true } hiddenOnInsert editable={ false } width='8%'>Failed</TableHeaderColumn>
          <TableHeaderColumn dataField='button' dataFormat={ this.deleteUserButton.bind(this) } hiddenOnInsert editable={ false } export={ false }>Action</TableHeaderColumn>
        </BootstrapTable>
        <br />
        <Tips />
      </div>
    );
  }
}

// Private helper methods
function supportedFormatter(cell){
  return cell ? 'yes' : 'no';
}

function isValidUsPhoneNumber(number) {
  if ((/^(\+?1)?( )?\(?(\d{3})\)?[-. ]?(\d{3})[-. ]?(\d{4})( x\d{4})?$/im.test(number))) {
    return true;
  }
  return false;  
}

// Helper function for getting a E.164 ID from a user entered number
function idFromNumber(number) {
  var bare_num = number.replace(/\D/g, '');
  if (bare_num.length === 10) {
    return ('+1'+bare_num);
  } else if ((bare_num.length === 11) && (bare_num[0] === '1')) {
    return ('+'+bare_num);
  } else {
    alert('Can\'t calculate key from '+number);
    return bare_num;
  }
}  

export default MemberTable;