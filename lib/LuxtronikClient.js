'use strict';

const net = require('net');
const {
  COMMANDS,
  createCommandBuffer,
  parseInt32ArrayResponse,
  parseCalculatedResponse,
} = require('./LuxtronikProtocol');

class LuxtronikClient {

  constructor(host) {
    this.host = host;
    this.port = 8888;
  }

  send(command) {

    return new Promise((resolve, reject) => {

      const socket = new net.Socket();

      socket.once('error', reject);

      socket.connect(this.port, this.host, () => {
        socket.write(createCommandBuffer(command));
      });

      socket.once('data', data => {

        socket.destroy();

        switch (command) {

          case COMMANDS.READ_PARAMETERS:
            resolve(parseInt32ArrayResponse(data));
            break;

          case COMMANDS.READ_CALCULATED:
            resolve(parseCalculatedResponse(data));
            break;

          default:
            resolve(data);

        }

      });

    });

  }

  async readParameters() {
    return this.send(COMMANDS.READ_PARAMETERS);
  }

  async readCalculated() {
    return this.send(COMMANDS.READ_CALCULATED);
  }

}

module.exports = LuxtronikClient;