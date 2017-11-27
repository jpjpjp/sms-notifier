import React from 'react';

class SMSForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: "", errorMessage: "", numbers: props.numbers };

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.getNumbers = props.getNumbers;
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
    if (this.state.value.length >= 100) {
      this.setState({
        errorMessage:
          "Message may be too long to send as one text.  Message may be split"
      });
    }
  }

  handleSubmit(event) {
    alert("Will try to send Message: " + this.state.value);
    let numbers = this.getNumbers();
    let numberString = numbers.join(',');
    fetch('/sendMessage', {
      method: 'POST',
      mode: 'cors', 
      redirect: 'follow',
      headers: new Headers({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({
        message: this.state.value,
        numbers: numberString
      }),
    })
    .then(res => {
      if (res.status === 200) {
        alert("Message sent succesfully");
      } else {
        alert('Messages failed to send.  Status: ' + res.status);
      }
      console.log(res.body);
    })    
    .catch(e => console.error(e));
  
    event.preventDefault();
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
          <textarea
            style={{ width: 400, height: 50 }}
            value={this.state.value}
            onChange={this.handleChange}
            placeholder="Enter your Text Message here...."
          />
        <br />
        <div className="Validation-Warning">
        {this.state.errorMessage}
        </div>
        <br />
        <input type="submit" value="Send It!" />
      </form>
    );
  }
}

export default SMSForm;