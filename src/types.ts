import { Socket } from "socket.io";

export interface IUser {
  address: string,
  name?: string,
  balance?: number,
  avatarId?: number,
  socket?: Socket,
}

export enum PlayerAction {
  NONE,
  CHECK,
  CALL,
  RAISE,
  ALLIN,
  FOLD,
}

export interface IPlayer {
  address: string,
  stack: number,
  status: PlayerAction,
}

export enum Round {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
}

export interface ITable {
  id: number,
  name: string,
  type: "NL Texas Hold'em" | "Pot Limit Omaha",
  smallBlind: number,
  bigBlind: number,
  players: IPlayer[],

  // round: Round,
  // pot: number,
  // lastRaiseAmount: number,
  // dealerId: number,
  // currentPlayerId: number,
  // cards?: number[],
  // timestamp: number,
}
