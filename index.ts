import SocketIO from "socket.io";
import http from 'http';
import express from 'express';
import path from "path";
import cors from 'cors';
import fs from 'fs';
import "dotenv/config";

import PokerService from "./src/services/pokerService";
import { connectDatabase } from "./src/configs/db";
import indexRouter from "./src/routes/index";

class App {
  private server: http.Server;
  private port: number;
  private io: SocketIO.Server;
  private pokerService!: PokerService;

  constructor(port: number) {
    this.port = port;

    const app = express();
    app.use(cors());
    app.set
    app.set("views", path.join(__dirname, "src/views"));
    app.set("view engine", "ejs");
    app.use(express.static(path.join(__dirname, "public")));
    // app.use(express.static(path.join(__dirname, '../../poker-client/build')));
    // app.get('*', (req, res) => {
    //   const contents = fs.readFileSync(
    //     path.resolve(__dirname, '../../poker-client/build/index.html'),
    //     'utf8',
    //   )
    //   res.send(contents)
    // })
    app.use("/", indexRouter);

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

new App(Number(5000));
