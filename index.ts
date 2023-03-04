import SocketIO from "socket.io";
import http from 'http';
import express from 'express';
import path from "path";
import cors from 'cors';
import fs from 'fs';
import "dotenv/config";

import PokerService from "./src/services/pokerService";
import { connectDatabase } from "./src/configs/db";

class App {
  private server: http.Server;
  private port: number;
  private io: SocketIO.Server;
  private pokerService!: PokerService;

  constructor(port: number) {
    this.port = port;

    const app = express();
    app.use(cors());
    app.use(express.static(path.join(__dirname, '../../poker-client/build')));
    app.get('*', (req, res) => {
      const contents = fs.readFileSync(
        path.resolve(__dirname, '../../poker-client/build/index.html'),
        'utf8',
      )
      res.send(contents)
    })

    this.server = new http.Server(app);
    this.io = new SocketIO.Server(this.server, {
      cors: {
        // origin: "*",
        methods: ["GET", "POST"]
      }
    });

    connectDatabase()
      .then(() => {
        this.run();
      })
  }

  public run() {
    this.server.listen(this.port);
    console.log(`Server listening on port ${this.port}`);

    this.pokerService = new PokerService(this.io);
    this.test();
  }

  test() {
  }
}

new App(Number(process.env.PORT));
