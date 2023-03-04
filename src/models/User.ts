import { model, Schema } from "mongoose";

export interface IUser {
  address: string,
  name?: string,
  balance: number,
  avatarUrl?: string,
  tables?: number[],
};

const UserSchema = new Schema({
  address: {
    type: String,
  },
  name: {
    type: String,
  },
  balance: {
    type: Number,
  },
  avatarUrl: {
    type: String,
  }
});

export const UserDB = model("User", UserSchema);
