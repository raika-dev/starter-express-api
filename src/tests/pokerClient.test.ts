import ioClient, { Socket } from 'socket.io-client';

describe('Socket.io server', () => {
  let user1: Socket;

  beforeEach(() => {
    // Initialize the Socket.io server
    user1 = ioClient("http://localhost:5000");
  });

  afterEach(() => {
    user1.close();
  });

  test('user connection and get data', (done) => {
    user1.on("connect", (() => {
      user1.emit("joinGame", {
        address: "0xRaika"
      });
    }));
    user1.on("lobbyInfo", (data) => {
      // console.log(data);
    });
    user1.on("userInfo", (data) => {
      console.log(data);
      done();
    });
    user1.on("error", (data) => {
      console.log(data);
      done(false);
    })
  });
});
