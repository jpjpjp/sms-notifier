import React from 'react';
import { Button, ControlLabel, FormGroup, FormControl, HelpBlock } from 'react-bootstrap';


class SMSForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { message: "", errorMessage: "", 
      numbers: props.numbers, 
      vmessage: 'Maximum text message length is 140 characters.'
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.getNumbers = props.getNumbers;
  }

  handleChange(event) {
    const length = this.state.message.length;
    let vMessage = 'Maximum text message length is 140 characters.';
    if (length >= 100) {
      vMessage = 'Messages longer than 140 characters can still be sent, but may get split into multiple messages.';
    }
    this.setState({ message: event.target.value, vmessage: vMessage });
  }

  getValidationState() {
    const length = this.state.message.length;
    if (length >= 100) {
      return 'error';
    }
    return 'success';
  }

  handleSubmit(event) {
    alert("Will try to send Message: " + this.state.message);
    let numbers = this.getNumbers();
    let numberString = numbers.join(',');
    let that = this;
    fetch('/sendMessage', {
      method: 'POST',
      mode: 'cors', 
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        "Authorization": localStorage.getItem('Authorization')
      },
      body: JSON.stringify({
        message: this.state.message,
        numbers: numberString
      }),
    })
    .then(res => {
      if (res.status === 200) {
        alert("Message sent succesfully");
      } else {
        alert('Messages failed to send.  Status: ' + res.status);
      }
      that.setState({isSending:false, message:''});
    })    
    .catch(e => {
      alert('Messages failed to send.  '+e.message)
      that.setState({isSending:false, message:''});
    });
  
    event.preventDefault();
    this.setState({isSending:true, message:''});
  }

  buttonIsActive() {
    let numbers = this.getNumbers();
    if ((numbers.length) && (this.state.message.length)) {
      return true;
    } else {
      return false;
    }
  }

  render() {
    const buttonIsActive=this.buttonIsActive()
    const isSending = this.state.isSending;
    const validationText = this.state.vmessage;
    return (
     // <form className="Form">
      <form onSubmit={this.handleSubmit}>
        <FormGroup 
          controlId="textMessageInputarea"
          validationState={this.getValidationState()}
        >
          <ControlLabel>Message from Albany Bike Rescue:</ControlLabel>
          <FormControl componentClass="textarea" 
            className="Text-Area"
            placeholder="Enter your Text Message here..." 
            onChange={this.handleChange}
            style={{ width: 400, height: 50}}
          />
          <ControlLabel>Reply STOP to opt out.</ControlLabel>
          <HelpBlock style={{ width: 370}}>{ validationText }</HelpBlock>
        </FormGroup>
        <br />
        <div className="Validation-Warning">
        {this.state.errorMessage}
        </div>
        <div>
          <Button bsStyle="primary" 
            onClick={ buttonIsActive ? this.handleSubmit : null } 
            disabled={ !buttonIsActive || isSending } 
            >
              { buttonIsActive ? 'Send It!' : isSending ? 'Sending....' : 'Nothing to Send Yet' }
            </Button>
        </div>
      </form>
    );
  }
}
/*
          <textarea
            style={{ width: 400, height: 50 }}
            message={this.state.message}
            onChange={this.handleChange}
            placeholder="Enter your Text Message here...."
          />
*/

export default SMSForm;