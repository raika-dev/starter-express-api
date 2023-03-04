import { Socket } from "socket.io";
/*
  NONE,
  SMALL_BLIND,
  BIG_BLIND,
  BET,
  CHECK,
  CALL,
  RAISE,
  ALLIN,
  FOLD,

  LEAVE,
  JOIN,
*/

export interface IPlayer {
  socket?: Socket,
  address: string,
  stack: number,
  betAmount: number,
  totalBet: number,
  status: string,
  position: number,
  cards: number[],
  prize?: number,
}
