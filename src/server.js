// import modules
const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

// set port
const port = process.env.PORT || process.env.NODE_PORT || 3000;

// read client html file into memory
const index = fs.readFileSync(`${__dirname}/../client/client.html`);

// function to handle HTTP requests
const onRequest = (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.write(index);
  response.end();
};

// create http server with callback, and listen for requests on specified port
const app = http.createServer(onRequest).listen(port);

console.log(`Listening on 127.0.0.1: ${port}`);

// Websocket server code, separate protocol from HTTP. 
// Pass HTTP server into socket.io and grab websocket server
const io = socketio(app);

// object to hold all users that have connected
const users = {};
const ids = {};

const onJoined = (sock) => {
  const socket = sock;

  socket.on('join', (data) => {
    // message back to new user
    const joinMsg = {
      name: 'server',
      msg: `There are ${Object.keys(users).length} users online`,
    };

    socket.name = data.name;
    users[socket.name] = socket.name;
    ids[socket.name] = socket.id;
    socket.emit('msg', joinMsg);

    socket.join('room1');

    // announcement to everyone in the room
    const response = {
      name: 'server',
      msg: `${data.name} has joined the room.`,
    };
    socket.broadcast.to('room1').emit('msg', response);

    console.log(`${data.name} joined`);
    // success message back to new user
    socket.emit('msg', { name: 'server', msg: 'You joined the room' });
  });
};

const onMsg = (sock) => {
  const socket = sock;

  socket.on('msgToServer', (data) => {
    io.sockets.in('room1').emit('msg', { name: socket.name, msg: data.msg });
  });

  // roll for user
  socket.on('roll', () => {
    const num = Math.random() * 6; // Get random number for "6 sided roll"
    const rolledNum = Math.floor(num); // round to whole number
    io.sockets.in('room1').emit('msg', { name: 'server', msg: `${socket.name} rolled a ${rolledNum} on a six sided die` });
  });
};

const onNameChange = (sock) => {
  const socket = sock;
  socket.on('changeName', (data) => {
    const oldName = socket.name; // Get current name
    delete users[socket.name]; // Delete current name from user object
    delete ids[socket.name]; // Delete corresponding id
    socket.name = data.name; // update socket name
    users[socket.name] = socket.name; // Add user back with new name
    ids[socket.name] = socket.id;

    // Send message to clients in room 1 about the name change
    io.sockets.in('room1').emit('msg', { name: 'server', msg: `${oldName} has changed their username to ${socket.name}` });
  });
};

const onWhisper = (sock) => {
  const socket = sock;

  socket.on('whisperToServer', (data) => {
    if (Object.prototype.hasOwnProperty.call(users, data.name)) {
      const id = ids[data.name];
      // Send message to specified user
      io.sockets.connected[id].emit('msg', { name: `${socket.name}(whispers)`, msg: data.msg });
      socket.emit('msg', { name: `${socket.name}(whispers)`, msg: data.msg });
    } else {
      // notify user of failure
      socket.emit('msg', { name: 'server', msg: 'The user you are trying to whisper to does not exist' });
    }
  });
};

const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    const message = `${socket.name} has left the room.`;

    socket.broadcast.to('room1').emit('msg', { name: 'server', msg: message });

    socket.leave('room1');

    delete users[socket.name];
    delete ids[socket.name];
  });
};

// Event built in to socket.io that fires every time there is a new connection
// and receives the new socket
io.sockets.on('connection', (socket) => {
  console.log('started');

  // send new socket to attach handlers
  onJoined(socket);
  onMsg(socket);
  onNameChange(socket);
  onWhisper(socket);
  onDisconnect(socket);
});

console.log('Websocket server started');
