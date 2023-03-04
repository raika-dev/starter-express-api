import { Server, Socket } from "socket.io";

import { Table } from "../models/Table";
import { IUser } from "../models/User";
import { userService } from "./userService";
import { logger } from "../helpers";

export default class PokerService {
  private io!: Server;
  public tables: { [key: string]: Table } = {};
  public users: Record<string, IUser> = {};
  public tableCounter: number = 0;

  constructor(io: Server) {
    this.io = io;
    this.buildConnection();

    // this.makeSomeTables();
    logger.info("Poker game service started");
  }

  buildConnection = () => {
    this.io.on("connection", (socket: Socket) => {
      this.sendMessage(socket, "ping");

      socket.on("joinGame", (data) => this.newConnection(socket, data));
      socket.on("lobbyInfo", () => this.sendMessage(socket, "lobbyInfo", this.lobbyInfo()));
      socket.on("createTable", (data) => this.createTable(socket, data));
      socket.on("takeSeat", (data) => this.takeSeat(socket, data));
      socket.on("tableInfo", (data) => this.tableInfo(socket, data));

      socket.on("leaveTable", (data) => this.leaveTable(socket, data));
      socket.on("fold", (data) => this.fold(socket, data));
      socket.on("call", (data) => this.call(socket, data));
      socket.on("raise", (data) => this.raise(socket, data));
      socket.on("check", (data) => this.check(socket, data));
      socket.on("allIn", (data) => this.allIn(socket, data));

      socket.on("disconnect", () => this.disconnect(socket));
      // socket.on("disconnect", (data) => logger.info("disconnected"));
    });
  }

  newConnection = async (socket: Socket, { address }: { address: string }) => {
    logger.info("connection from", address);
    if (!address) {
      this.sendMessage(socket, "error", "connect your wallet");
      return;
    }

    const user = await userService.getUser(address);
    this.users[address] = user;
    this.sendMessage(socket, "userInfo", {
      address: user.address,
      name: user.name,
      balance: user.balance,
      avatarUrl: user.avatarUrl,
    });
    this.sendMessage(socket, "lobbyInfo", this.lobbyInfo());
  }

  createTable = async (socket: Socket, data: any) => {
    console.log("request to create");
    const { address, name, type, smallBlind, bigBlind, buyIn } = data;
    if (!address || !name || !type || !smallBlind || !bigBlind || !buyIn) {
      this.sendMessage(socket, "error", "Invalid data");
      return;
    }
    const user = await userService.getUser(address);

    if (user.balance < buyIn || buyIn < bigBlind * 10) {
      this.sendMessage(socket, "error", "Not enough chips to create the table");
      return;
    }

    logger.info("creating from ", data);
    logger.info("table created ID:", this.tableCounter);
    this.tables[this.tableCounter] = new Table(
      this.io,
      Number(this.tableCounter),
      name,
      type,
      smallBlind,
      bigBlind,
    );

    await this.takeSeat(socket, {
      address,
      tableId: this.tableCounter,
      position: 0,
      buyIn,
    });
    this.tableCounter++;
    this.broadcastMessage("lobbyInfo", this.lobbyInfo());
  }

  tableInfo = async (socket: Socket, data: any) => {
    const { address, tableId } = data;
    if (!address || typeof tableId == undefined || tableId >= this.tables.length) {
      this.sendMessage(socket, "error", "Invalid data");
      return;
    }
    this.sendMessage(socket, "tableInfo", await this.tables[tableId].info(address));
    socket.join("room-" + tableId);
  }

  takeSeat = async (socket: Socket, data: any) => {
    const { address, tableId, position, buyIn } = data;
    if (
      !address ||
      typeof tableId == undefined ||
      typeof position == undefined ||
      typeof buyIn == undefined ||
      !this.tables[tableId] || position >= 6
    ) {
      this.sendMessage(socket, "error", "Invalid data");
      return;
    }
    const table = this.tables[tableId];
    if (table?.players[position]?.address) {
      this.sendMessage(socket, "error", "That seat is already taken by other one");
      return;
    }
    if (table.getPosition(address) >= 0) {
      this.sendMessage(socket, "error", "You already participated in the table");
      return;
    }
    const user = await userService.getUser(address);
    if (user.balance < buyIn || buyIn < table.minBuyIn) {
      this.sendMessage(socket, "error", `You need at least ${table.minBuyIn}chips`);
      return;
    }
    user.balance -= buyIn;
    userService.updateUser(user);

    table.takeSeat({
      socket,
      address,
      stack: buyIn,
      betAmount: 0,
      totalBet: 0,
      status: "FOLD",
      cards: [] as number[],
      position: data.position,
    }, data.position);

    console.log(`${address} is taking seat at ${position} on table ${tableId}`);

    this.tableInfo(socket, { address, tableId });
  }

  lobbyInfo = () => {
    let data = Object.values(this.tables).map(table => table.infoForLobby());
    return data;
  }

  // table actions
  check = async (socket: Socket, data: any) => {
    this.tables[data.id].check();
  }

  fold = async (socket: Socket, data: any) => {
    this.tables[data.id].fold();
  }

  call = async (socket: Socket, data: any) => {
    this.tables[data.id].call();
  }

  raise = async (socket: Socket, data: any) => {
    this.tables[data.id].raise(data.amount);
  }

  allIn = async (socket: Socket, data: any) => {
    this.tables[data.id].allIn();
  }

  leaveTable = async (socket: Socket, data: any) => {
    this.tables[data.id].leaveSeat(data.position);
  }

  sendMessage = (socket: Socket, channel: string, data: any = {}) => {
    socket.emit(channel, data);
  }

  broadcastMessage = (channel: string, data: any = {}) => {
    this.io.emit(channel, data);
  }

  disconnect = (socket: Socket) => {
    let shouldUpdate: boolean = false;
    Object.keys(this.tables).forEach(key => {
      let table = this.tables[key];
      let pos = table.getPlayerPosition(socket);
      if (pos >= 0) table.leaveSeat(pos);
      if (!table.numberOfPlayers()) { // only one player
        delete this.tables[key];
        shouldUpdate = true;
      }
    });
    if (shouldUpdate) {
      console.log("~~ huhu ~~ I clean the dashboard :)")
      this.broadcastMessage("lobbyInfo", this.lobbyInfo());
    }
  }
}
