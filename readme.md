Tropo Form Server Project

form_server. js is a simple node.js server that presents a form which asks a user to put
in a phone number, a "network" (SMS or PSTN) and message.   It sends the response to 
a Tropo app which will call or text the number and play/display the message.   
It was based on this project: https://www.sitepoint.com/creating-and-handling-forms-in-node-js/

form.html is the very basic form that is displayed.

Start the server on the cmd line:
> node form_server.js

To-Do:
-- Make this a heroku project
-- Figure out why the form takes so long to load after the first time (and why do the site always get two requests?