import { Socket, Server } from "socket.io";
import { IPlayer } from "../Player";
const Hand = require("pokersolver").Hand;
import {
  shuffledCards,
  nextActivePlayerId,
  isValid,
  isActive,
  COUNT_DOWN,
  ANIMATION_DELAY_TIME,
  numberOfPlayers,
  playersInfo,
  nullPlayer,
  numberOfActivePlayers,
  numbersToCards,
} from "./utils";

export enum Round {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
  OVER,
}

export class Table {
  server!: Server;

  id!: number;
  name!: string;
  type!: "NL Texas Hold'em" | "Pot Limit Omaha";
  smallBlind!: number;
  bigBlind!: number;
  players: IPlayer[] = [];
  minBuyIn!: number;

  round!: Round;
  pot: number = 0;
  currentBet: number = 0;
  minRaise: number = 0;
  dealerId: number = 0;
  currentPlayerId: number = 0;
  cards: number[] = [];
  communityCards: number[] = [];
  countdown!: number;
  timestamp!: number;
  status: string = "WAIT";
  isLockup: boolean = false;
  leaveList: number[] = [];
  plusBet: number = 0; // for last action (currentBet - player.betAmount)
  prizes: number[] = [];
  lastNewPlayerId: number = -1;

  constructor(server: Server, id: number, name: string, type: "NL Texas Hold'em" | "Pot Limit Omaha", smallBlind: number, bigBlind: number) {
    this.server = server;
    this.id = id;
    this.name = name;
    this.type = type;
    this.smallBlind = smallBlind;
    this.bigBlind = bigBlind;
    this.minBuyIn = this.bigBlind * 10;
    this.round = Round.OVER;
    this.countdown = 1;
    for (let i = 0; i < 6; i++) this.players[i] = nullPlayer();
    this.test();
  }

  takeSeat(player: IPlayer, position: number) {
    player.status = "JOIN";
    this.players[position] = player;
    this.lastNewPlayerId = position;
    this.broadcast();
    if (this.status == "WAIT") this.newHand();
  }

  leaveSeat(pos: number) {
    let player = this.players[pos];
    if (isValid(player)) {
      player.status = "DISCONNECT";
      this.broadcast();
    }
  }

  sitOut() {
  }

  newHand() {
    console.log("new hand");
    this.status = "WAIT";
    for (let i = 0; i < 6; i++)
      if (!this.players[i].stack || this.players[i].status == "DISCONNECT") this.players[i] = nullPlayer();

    if (numberOfPlayers(this.players) < 2) {
      console.log("not enough people to start the game");
      this.broadcast();
      return;
    }
    console.log("new hand begins!");
    this.cards = shuffledCards();
    this.pot = 0;
    this.isLockup = false;
    this.minRaise = this.bigBlind * 2;
    for (let i = 0; i < 6; i++) {
      if (isValid(this.players[i])) {
        this.players[i].cards = [this.cards.pop() ?? 0, this.cards.pop() ?? 0];
        this.players[i].betAmount = 0;
        this.players[i].totalBet = 0;
      }
    }
    this.communityCards = [];
    for (let i = 0; i < 6; i++) {
      if (isValid(this.players[i])) {
        this.players[i].status = "NONE";
      }
    }
    if (this.lastNewPlayerId != -1) this.dealerId = this.lastNewPlayerId;
    this.dealerId = nextActivePlayerId(this.dealerId, this.players);
    this.lastNewPlayerId = -1;

    this.preflop();
  }

  checkRoundResult() {
    let cnt = 0;
    console.log("************************");
    console.log(this.currentBet);
    console.log(this.players.map(player => player.betAmount));
    console.log(this.players.map(player => player.status));

    for (let i = 0; i < 6; i++) {
      if (isActive(this.players[i])) {
        if (this.players[i].betAmount != this.currentBet && this.players[i].status != "ALLIN")
          return "RUNNING";
        if (this.players[i].status == "NONE")
          return "RUNNING";
        if (this.players[i].status != "ALLIN") cnt++;
      }
    }
    console.log("cnt", cnt);
    if (cnt < 2) return "LOCKUP";
    return "ENDED";
  }

  moveTurn() {
    this.countdown = COUNT_DOWN;
    this.broadcast();
    setTimeout(() => {
      this.currentPlayerId = nextActivePlayerId(this.currentPlayerId, this.players);
      if (!numberOfActivePlayers(this.players)) console.log("what a bug on", this.id);

      if (numberOfActivePlayers(this.players) <= 1) { // win the pot uncontested
        this.final();
        return;
      }
      let roundResult = this.checkRoundResult();
      console.log("--", roundResult);
      if (roundResult != "RUNNING") {
        this.round = (this.round + 1) % 5;
        if (roundResult == "ENDED") {
          for (let i = 0; i < 6; i++) {
            if (isActive(this.players[i])) {
              if (this.players[i].status != "ALLIN") {
                this.players[i].status = "NONE";
              }
            }
          }
        }
        switch (this.round) {
          case Round.FLOP:
            this.flop();
            break;
          case Round.TURN:
            this.turn();
            break;
          case Round.RIVER:
            this.river();
            break;
          case Round.OVER:
            this.final();
            break;
        }
        if (roundResult == "LOCKUP" && this.round < Round.OVER) {
          console.log("locked up on", this.id);
          this.isLockup = true;
          setTimeout(() => {
            this.updatePlayers();
            this.moveTurn();
          }, ANIMATION_DELAY_TIME);
        } else if (this.round < Round.OVER && numberOfActivePlayers(this.players)) {
          setTimeout(() => {
            this.updatePlayers();
            this.status = "IDLE";
            this.countdown = COUNT_DOWN;
            this.tick();
            this.currentPlayerId = nextActivePlayerId(this.dealerId, this.players);
            this.broadcast();
          }, ANIMATION_DELAY_TIME);
        }
      }
      else {
        this.status = "IDLE";
        this.tick();
        this.countdown = COUNT_DOWN;
        if (!this.status.includes("BLIND")) this.broadcast();
      }
    }, ANIMATION_DELAY_TIME);
  }

  // pot and bet update of players
  updatePlayers() {
    this.minRaise = this.bigBlind;
    this.currentBet = 0;
    for (let i = 0; i < 6; i++) {
      this.pot += this.players[i].betAmount;
      this.players[i].totalBet += this.players[i].betAmount;
      this.players[i].betAmount = 0;
    }
  }

  preflop() {
    this.round = Round.PREFLOP;
    this.countdown = COUNT_DOWN;
    this.status = "PREFLOP";
    this.broadcast();
    // small blind
    setTimeout(() => {
      this.currentPlayerId = nextActivePlayerId(this.dealerId, this.players);
      this.smallBlindFn();
      // big blind
      setTimeout(() => { this.bigBlindFn() }, ANIMATION_DELAY_TIME);
    }, ANIMATION_DELAY_TIME * numberOfActivePlayers(this.players));
  }

  flop() {
    this.status = "FLOP";
    this.communityCards.push(this.cards.pop() ?? 0);
    this.communityCards.push(this.cards.pop() ?? 0);
    this.communityCards.push(this.cards.pop() ?? 0);
    this.broadcast();
  }

  turn() {
    this.status = "TURN";
    this.communityCards.push(this.cards.pop() ?? 0);
    this.broadcast();
  }

  river() {
    this.status = "RIVER";
    this.communityCards.push(this.cards.pop() ?? 0);
    this.broadcast();
  }

  final() {
    this.status = "FINAL";
    this.broadcast();
    setTimeout(() => { this.over() }, ANIMATION_DELAY_TIME * 3);
  }

  over() {
    let players = this.players;
    let earnings = [0, 0, 0, 0, 0, 0];
    this.updatePlayers();
    for (let i = 0; i < 6; i++)
      console.log(players[i].totalBet);
    let oldStatus = players.map(player => player.status);
    while (numberOfActivePlayers(players)) {
      let hands = [], arr = [];
      for (let i = 0; i < 6; i++) {
        if (isActive(players[i])) {
          hands[i] = Hand.solve(
            numbersToCards(players[i].cards.concat(this.communityCards)));
          arr.push(hands[i]);
        }
      }
      let winners = Hand.winners(arr);
      for (let winner of winners) console.log(winner.cards, winner.descr);
      console.log("--------");
      let order = [];
      for (let i = 0; i < 6; i++) {
        if (winners.includes(hands[i])) order.push(i);
      }
      console.log(order);
      order.sort((a, b) => players[b].totalBet - players[a].totalBet);
      while (order.length) {
        let cur = order[order.length - 1];
        let prize = 0, curAmount = players[cur].totalBet;
        for (let i = 0; i < 6; i++) {
          prize += Math.min(curAmount, players[i].totalBet);
          players[i].totalBet -= Math.min(curAmount, players[i].totalBet);
        }
        console.log(curAmount, prize);
        for (let i of order) {
          let v = Math.floor(prize / order.length);
          players[i].stack += v;
          console.log("---", i, v, players[i].stack, this.players[i].stack);
          earnings[i] += v;
        }
        players[cur].status = "FOLD";
        order.pop();
      }
    }
    for (let i = 0; i < 6; i++) players[i].status = oldStatus[i];
    console.log("----------------- END --------------------");
    console.log(players.map(player => player.stack));
    this.status = "OVER";
    this.prizes = earnings;
    this.broadcast();

    setTimeout(() => {
      this.communityCards = [];
      this.newHand();
    }, ANIMATION_DELAY_TIME * 3);
  }

  stake(amount: number) {
    const player = this.players[this.currentPlayerId];
    amount = Math.min(amount, player.stack);
    player.stack -= amount;
    player.betAmount += amount;
    this.plusBet = amount;
    if (!player.stack) player.status = "ALLIN";
  }

  smallBlindFn() {
    console.log("small blind on ", this.id);
    this.status = "SMALL_BLIND";
    this.players[this.currentPlayerId].status = "SMALL_BLIND";
    this.stake(this.smallBlind);
    this.moveTurn();
  }

  bigBlindFn() {
    console.log("big blind on ", this.id);
    this.status = "BIG_BLIND";
    this.players[this.currentPlayerId].status = "BIG_BLIND";
    this.currentBet = this.bigBlind;
    this.stake(this.bigBlind);
    this.moveTurn();
    setTimeout(() => {
      for (let i = 0; i < 6; i++)
        if (isActive(this.players[i])) this.players[i].status = "NONE";
    }, ANIMATION_DELAY_TIME);
  }

  call() {
    console.log("call on", this.id);
    this.status = "CALL";
    let player = this.players[this.currentPlayerId];
    player.status = "CALL";
    this.stake(this.currentBet - player.betAmount);
    this.moveTurn();
  }

  fold() {
    console.log("fold on", this.id);
    this.status = "FOLD";
    let player = this.players[this.currentPlayerId];
    player.status = "FOLD";
    this.moveTurn();
  }

  check() {
    console.log("check on", this.id);
    this.status = "CHECK";
    let player = this.players[this.currentPlayerId];
    player.status = "CHECK";
    this.moveTurn();
  }

  allIn() {
    console.log("allin on", this.id);
    this.status = "ALLIN";
    let player = this.players[this.currentPlayerId];
    player.status = "ALLIN";
    if (player.stack > this.currentBet) {
      this.minRaise = player.stack + player.stack - this.currentBet;
      this.currentBet = player.stack;
    }
    this.stake(player.stack);
    this.moveTurn();
  }

  raise(amount: number) {
    this.status = "RAISE";
    let player = this.players[this.currentPlayerId];
    player.status = "RAISE";
    this.minRaise = amount + amount - Math.max(this.bigBlind, this.currentBet);
    this.currentBet = amount;
    this.stake(amount - player.betAmount);
    this.moveTurn();
  }

  infoForLobby() {
    const { id, name, type, smallBlind, bigBlind, minBuyIn, } = this;
    return {
      id, name, type, smallBlind, bigBlind, minBuyIn,
      activePlayersCnt: numberOfPlayers(this.players),
    };
  }

  info = async (viewer: string = "") => {
    let data = {
      id: this.id,
      name: this.name,
      type: this.type,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      round: this.round,
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerId: this.dealerId,
      currentPlayerId: this.currentPlayerId,
      countdown: this.countdown,
      status: this.status,
      communityCards: this.communityCards,
      plusBet: this.plusBet,
      players: this.players,
    };
    // if (data.status.includes("BLIND") || data.status == "CALL" || data.status == "RAISE" || data.status == "ALLIN") {
    //   data.status = "BET";
    // }
    data.players = await playersInfo(this.players, (this.round == Round.OVER || this.isLockup) ? "all" : viewer);
    data.players.forEach((player, index) => {
      if (isActive(player)) {
        if (index != this.currentPlayerId || this.isLockup) player.status = "IDLE";
        else if (this.status == "IDLE") player.status = "ACTIVE";
        else if (player.status.includes("BLIND") || player.status == "CALL" || player.status == "RAISE" || player.status == "ALLIN") player.status = "BET";
      }
      player.prize = this.prizes[index];
    });
    return data;
  }

  getPosition = (address: string) => {
    for (let i = 0; i < 6; i++)
      if (this.players[i].address == address) return i;
    return -1;
  }

  tick = async () => {
    this.countdown--;
    // console.log(this.countdown);
    if (this.status == "IDLE") {
      if (this.countdown < 0) this.fold();
      else setTimeout(this.tick, 1000);
    }
  }

  broadcast(channel: string = "") {
    // console.log("-- broadcast on", this.id);
    console.log(this.status, this.currentPlayerId);
    console.log(this.players.map(player => player.status));
    console.log(this.players.map(player => player.betAmount));

    this.server.in("room-" + this.id).fetchSockets().then((sockets) => {
      for (let socket of sockets) {
        let viewer = "";
        this.players.forEach(player => {
          if (player.socket?.id == socket.id) viewer = player.address;
        });
        this.info(viewer).then((data) => {
          socket.emit("tableInfo", data);
        });
      }
    });
  }

  getPlayerPosition(socket: Socket) {
    for (let i = 0; i < 6; i++) {
      if (this.players[i].socket?.id == socket.id)
        return i;
    }
    return -1;
  }

  isSocketOfPlayer(socket: Socket) {
    return this.getPlayerPosition(socket) > -1;
  }

  numberOfPlayers() {
    return numberOfPlayers(this.players);
  }
  test() {
  }
}
