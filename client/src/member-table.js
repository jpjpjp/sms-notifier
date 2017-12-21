import React from 'react';
import { Button } from 'react-bootstrap';
import { BootstrapTable, TableHeaderColumn, ButtonGroup } from 'react-bootstrap-table';
require('./member-table.css');
require('react-bootstrap-table/dist/react-bootstrap-table-all.min.css');

const MemberHeader = () => (
  <div className='Member-Managment'>
    <h2>Volunteer Member List</h2>
    <h4>Messages are sent to the phone number for each member who's row is checked.<br/></h4>   
  By default all members who haven't explicitly opted out of Text Notifications are checked, but you can modify the recipients for your mesage before hitting the send button.
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
    row.oldNumber=row.number;
  } else if(cellName === 'email') {
    if (!cellValue.match(/^([\w.%+-]+)@([\w-]+\.)+([\w]{2,})$/i)) {
      alert(`${cellValue} is an invalid email address.  Ignoring Change`);
      return false;
    }
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
    cellEditProp.onRefreshData = props.handleRefreshData; 
  }

  onClickDeleteMember(cell, row, rowIndex){
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

  onRefreshData(){
    cellEditProp.onRefreshData();
  }

  // We create a custom button group to add our "Refresh Data Button"
  createCustomButtonGroup = props => {
    return (
      <ButtonGroup className='my-custom-class' sizeClass='btn-group-md'>
        { props.exportCSVBtn }
        { props.insertBtn }
        { props.showSelectedOnlyBtn }
        { props.deleteBtn }
        <Button 
          bsStyle="success"
          onClick={this.onRefreshData}>
            Refresh Sent/Failed Counts
        </Button>
      </ButtonGroup>
    );
  }


  render() {
    if (!this.props.dbInitiatalized) {
      return (null);
    }
    if (!this.props.dbConnected) {
      return (
        <div className='my-notify-error'>
          Backend not available.  Please try again later.
        </div>
      );
    }
    const selectRow = {
      mode: 'checkbox', //radio or checkbox
      selected: this.props.optIns,
      onSelect:  this.props.handleRowSelectCallback,
      onSelectAll: this.props.handleSelectAllCallback,
      showOnlySelected: true
    };

    const tableOptions = {
      // Use our custom button group
      btnGroup: this.createCustomButtonGroup
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
          <TableHeaderColumn dataField='email' dataSort={ true }>Email</TableHeaderColumn>
          <TableHeaderColumn dataField='isAdmin' dataSort={ true } editable={ { type: 'checkbox', options: { values: 'true:false' } } }>Admin</TableHeaderColumn>          
          <TableHeaderColumn dataField='optOut'  dataFormat={supportedFormatter} dataSort={ true } hiddenOnInsert editable={ false } width='8%'>OptOut</TableHeaderColumn>
          <TableHeaderColumn dataField='confirmedSent' dataSort={ true } hiddenOnInsert editable={ false } width='8%'># Sent </TableHeaderColumn>
          <TableHeaderColumn dataField='confirmedFailed' dataSort={ true } hiddenOnInsert editable={ false } width='8%'># Failed</TableHeaderColumn>
          <TableHeaderColumn dataField='button' dataFormat={ this.deleteUserButton.bind(this) } hiddenOnInsert editable={ false } export={ false }>Action</TableHeaderColumn>
        </BootstrapTable>
      </div>
    );
  }
}

// Stuff I may add back to the table some day
// Editable Admin Field.   The issue I ran into here was treating true
//<TableHeaderColumn dataField='isAdmin' editable={ { type: 'checkbox', options: { values: 'true:false' } } }>Admin</TableHeaderColumn>          


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
    return ('1'+bare_num);
  } else if (!((bare_num.length === 11) && (bare_num[0] === '1'))) {
    alert('Can\'t calculate key from '+number);
  }
  return bare_num;
}  

export default MemberTable;
